import {
  ActionHandlerContext,
  createWorkerAddon,
  DirectoryItem,
  PlayableItem,
  SeriesEpisodeItem
} from "@watchedcom/sdk";

const DIRECTORY_LIMIT = 100;

const TYPE_CONVERT = {
  v: "movie",
  s: "series"
};

const fetchApi = async (ctx: ActionHandlerContext, url: string) => {
  const res = await ctx.fetch(url);
  const data: any = await res.json();
  if (data?.code === "NotFound") throw new Error("Not found");
  return data;
};

export const tubiTvAddon = createWorkerAddon({
  id: "tubitv.com",
  name: "tubi",
  version: require("../package").version,
  icon: "https://tubitv.com/favicon.ico",
  poster: "https://cdn.adrise.tv/web/android-chrome-192x192.png",
  itemTypes: ["movie", "series"],
  defaultDirectoryFeatures: {
    search: { enabled: true }
  },
  regions: {
    forbidden: ["de"]
  }
});

const convertItem = (data: any): PlayableItem => {
  let episodes: undefined | SeriesEpisodeItem[] = undefined;
  if (TYPE_CONVERT[data.type] === "series" && data.children) {
    episodes = [];
    for (const season of data.children) {
      for (const episode of season.children) {
        const m = /^S0*(\d+):E0*(\d+) - (.*)$/.exec(episode.title);
        if (!m)
          throw new Error(`Failed matching series title: ${episode.title}`);
        episodes.push({
          ids: { id: episode.id },
          name: m[3],
          description: episode.description,
          season: parseInt(m[1], 10),
          episode: parseInt(m[2], 10),
          sources: episode.video_resources
            ? episode.video_resources.map((res: any) => ({
                id: "main",
                type: "url",
                url: res.manifest.url,
                format: res.type
              }))
            : undefined
        });
      }
    }
  }
  return {
    ids: { id: data.id },
    type: TYPE_CONVERT[data.type],
    name: data.title,
    genres: data.tags,
    description: data.description,
    countries: data.country ? [data.country] : undefined,
    year: data.year,
    director: data.directors,
    runtime: data.duration,
    cast: data.actors,
    images: {
      poster: data.posterarts?.[0],
      background: data.backgrounds?.[0],
      logo: data.logo
    },
    episodes,
    sources: data.url
      ? [
          {
            id: "main",
            type: "url",
            url: data.url
          }
        ]
      : undefined
  };
};

tubiTvAddon.registerActionHandler("directory", async (input, ctx) => {
  await ctx.requestCache([input.region, input.id], {
    ttl: "forever",
    refreshInterval: 8 * 3600 * 1000
  });

  if (!input.id) {
    // Categories
    const data: any = await fetchApi(
      ctx,
      "https://tubitv.com/oz/containers?expand=0"
    );
    const items: DirectoryItem[] = [];
    for (const entry of Object.values(data.hash) as any[]) {
      items.push({
        id: entry.id,
        name: entry.title,
        description: entry.description,
        type: "directory",
        images: {
          poster: entry.thumbnail,
          background: entry.backgrounds[0],
          logo: entry.logo
        }
      });
    }
    return {
      options: {
        imageShape: "landscape",
        displayName: true
      },
      items,
      hasMore: false
    };
  } else if (input.search) {
    const data: any = await fetchApi(
      ctx,
      `https://tubitv.com/oz/search/${input.search}`
    );
    const items = data.map(convertItem);
    return {
      items,
      hasMore: false
    };
  } else {
    // Single directory
    const offset = ((input.page ?? 1) - 1) * DIRECTORY_LIMIT;
    const data: any = await fetchApi(
      ctx,
      `https://tubitv.com/oz/containers/${input.id}/content?parentId&cursor=${offset}&limit=${DIRECTORY_LIMIT}`
    );
    const items = Object.values(data.contents).map(convertItem);
    return {
      items,
      hasMore: data[input.id]?.cursor ? true : false
    };
  }
});

tubiTvAddon.registerActionHandler("item", async (input, ctx) => {
  await ctx.requestCache([input.region, input.type, input.ids.id]);
  if (input.type === "movie") {
    const data = await fetchApi(
      ctx,
      `https://tubitv.com/oz/videos/${input.ids.id}/content`
    );
    return convertItem(data);
  } else {
    const data = await fetchApi(
      ctx,
      `http://tubitv.com/oz/videos/0${input.ids.id}/content`
    );
    return convertItem(data);
  }
});
