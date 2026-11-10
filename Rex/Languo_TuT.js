/**
 * 蓝果 Forward/Rex Widget v1.0.0
 * API: https://languo.ai
 */

WidgetMetadata = {
  id: "forward.languoai.tut",
  title: "蓝果",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "蓝果短剧：分类/热榜/搜索/分集播放；支持自选 API 节点",
  author: "Sting",
  site: "https://languo.ai",
  detailCacheDuration: 180,
  globalParams: [
    {
      name: "apiBase",
      title: "API 地址",
      type: "input",
      value: "https://languo.ai"
    },
    {
      name: "coverProxy",
      title: "封面解密/反代",
      type: "input",
      value: ""
    }
  ],
  modules: [
    {
      id: "loadList",
      title: "分类",
      functionName: "loadList",
      cacheDuration: 300,
      params: [
        { name: "page", title: "页码", type: "page" },
        {
          name: "tid",
          title: "分类",
          type: "enumeration",
          value: "hot",
          enumOptions: [
            { title: "热门短剧", value: "hot" },
            { title: "最新上线", value: "new" },
            { title: "排行榜", value: "rank" },
            { title: "AI漫剧", value: "ai-manju" },
            { title: "AI换脸", value: "ai-huanlian" },
            { title: "都市爽文", value: "tag:dushi" },
            { title: "现代言情", value: "tag:xiandai" },
            { title: "逆袭首富", value: "tag:nixi" },
            { title: "战神归来", value: "tag:zhanshen" },
            { title: "古装穿越", value: "tag:guzhuang" },
            { title: "甜宠虐恋", value: "tag:tianchong" }
          ]
        }
      ]
    },
    {
      id: "loadResource",
      title: "播放资源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 0,
      params: []
    }
  ],
  search: {
    title: "搜索",
    functionName: "search",
    params: [
      { name: "keyword", title: "关键词", type: "input" },
      { name: "page", title: "页码", type: "page" }
    ]
  }
};

function t(v) {
  return String(v == null ? "" : v).trim();
}

function cfg(params) {
  params = params || {};
  return {
    apiBase: t(params.apiBase || "https://languo.ai").replace(/\/+$/, ""),
    coverProxy: t(params.coverProxy || "").replace(/\/+$/, "")
  };
}

function qs(obj) {
  var parts = [];
  Object.keys(obj || {}).forEach(function (k) {
    if (obj[k] == null || obj[k] === "") return;
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(obj[k])));
  });
  return parts.length ? "?" + parts.join("&") : "";
}

async function httpJson(url) {
  var res = await Widget.http.get(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      Referer: "https://languo.ai/"
    }
  });
  var d = res && res.data;
  if (typeof d === "string") {
    try { d = JSON.parse(d); } catch (e) {}
  }
  return d;
}

function absCover(base, cover, coverProxy) {
  cover = t(cover);
  if (!cover) return "";
  var fullUrl = cover;
  if (cover.indexOf("//") === 0) fullUrl = "https:" + cover;
  else if (!/^https?:\/\//i.test(cover)) fullUrl = base + (cover[0] === "/" ? "" : "/") + cover;
  
  if (coverProxy) {
    return coverProxy + (coverProxy.indexOf("?") >= 0 ? "&" : "?") + "url=" + encodeURIComponent(fullUrl);
  }
  return fullUrl;
}

function toItem(c, it) {
  if (!it) return null;
  var id = t(it.id != null ? it.id : it.vod_id);
  if (!id) return null;
  var title = t(it.title || it.vod_name || it.name);
  var cover = absCover(c.apiBase, it.cover || it.vod_pic || it.pic || "", c.coverProxy);
  var ep = it.episode_count || it.total_episodes || "";
  var remark = "";
  if (it.is_finished) remark = "全" + (ep || "") + "集";
  else if (ep) remark = "更新至" + ep + "集";

  return {
    id: "lgai:" + id,
    type: "url",
    title: title || id,
    coverUrl: cover,
    posterPath: cover,
    backdropPath: cover,
    description: remark,
    mediaType: "tv",
    link: "lgai:" + id
  };
}

async function fetchList(c, tid, page) {
  page = Number(page || 1) || 1;
  tid = t(tid) || "hot";
  var data, items = [];

  // 排行榜路由
  if (tid === "rank" || tid === "ranks") {
    try {
      data = await httpJson(c.apiBase + "/api/ranks/hot" + qs({ page: page }));
      items = (data && data.data && data.data.items) || (data && data.data && data.data.list) || [];
    } catch (e) {}
  }

  // 标签分类路由
  if (!items.length && String(tid).indexOf("tag:") === 0) {
    try {
      data = await httpJson(c.apiBase + "/api/videos" + qs({ page: page, page_size: 24, sort: "hot", tag: tid.slice(4) }));
      items = (data && data.data && data.data.items) || (data && data.data && data.data.list) || [];
    } catch (e) {}
  }

  // 默认最新/热门流
  if (!items.length) {
    var sort = tid === "new" ? "new" : "hot";
    try {
      data = await httpJson(c.apiBase + "/api/videos" + qs({ page: page, page_size: 24, sort: sort }));
      items = (data && data.data && data.data.items) || (data && data.data && data.data.list) || [];
      if (tid === "ai-manju") items = items.filter(function (x) { return String(x.title || "").indexOf("漫") >= 0; });
      if (tid === "ai-huanlian") items = items.filter(function (x) { return String(x.title || "").indexOf("换脸") >= 0; });
    } catch (e) {}
  }

  var out = [];
  for (var i = 0; i < items.length; i++) {
    var item = toItem(c, items[i]);
    if (item) out.push(item);
  }
  return out;
}

async function loadList(params) {
  params = params || {};
  return await fetchList(cfg(params), t(params.tid) || "hot", Number(params.page || 1) || 1);
}

async function search(params) {
  params = params || {};
  var c = cfg(params);
  var kw = t(params.keyword);
  if (!kw) return [];
  var page = Number(params.page || 1) || 1;

  try {
    var data = await httpJson(c.apiBase + "/api/search" + qs({ q: kw, page: page }));
    var items = (data && data.data && data.data.items) || (data && data.data && data.data.list) || [];
    if (items.length) {
      var out = [];
      for (var i = 0; i < items.length; i++) {
        var item = toItem(c, items[i]);
        if (item) out.push(item);
      }
      return out;
    }
  } catch (e) {}

  var all = await fetchList(c, "hot", page);
  return all.filter(function (x) { return String(x.title || "").indexOf(kw) >= 0; });
}

function parseLink(link) {
  var s = t(link).replace(/^languoai:/, "lgai:");
  if (s.indexOf("lgai:") === 0) s = s.slice(5);
  var parts = s.split(":");
  return { id: t(parts[0]), ep: t(parts[1] || "") };
}

async function loadDetail(link) {
  var p = parseLink(link);
  if (!p.id) return null;
  var c = cfg({});
  var data = await httpJson(c.apiBase + "/api/videos/" + encodeURIComponent(p.id));
  var d = (data && data.data) || {};
  var cover = absCover(c.apiBase, d.cover || "", c.coverProxy);
  var eps = Array.isArray(d.episodes) ? d.episodes : [];
  var episodeItems = [];

  if (eps.length) {
    for (var i = 0; i < eps.length; i++) {
      var ep = eps[i];
      var n = ep.ep_num || ep.episode || (i + 1);
      var epLink = "lgai:" + p.id + ":" + n;
      episodeItems.push({
        id: epLink,
        type: "url",
        title: t(ep.title || ("第" + n + "集")),
        mediaType: "tv",
        seasonNumber: 1,
        episodeNumber: Number(n) || (i + 1),
        link: epLink,
        videoUrl: "",
        playerType: "app"
      });
    }
  } else {
    episodeItems.push({
      id: "lgai:" + p.id + ":1",
      type: "url",
      title: "第1集",
      mediaType: "tv",
      seasonNumber: 1,
      episodeNumber: 1,
      link: "lgai:" + p.id + ":1",
      videoUrl: "",
      playerType: "app"
    });
  }

  return {
    id: "lgai:" + p.id,
    type: "url",
    title: t(d.title || p.id),
    coverUrl: cover,
    posterPath: cover,
    backdropPath: cover,
    description: t(d.description || ""),
    mediaType: "tv",
    link: "lgai:" + p.id,
    episodeItems: episodeItems
  };
}

async function loadResource(params) {
  params = params || {};
  var c = cfg(params);
  var p = parseLink(t(params.link || params.id || ""));
  if (!p.id) return [];
  var ep = p.ep || t(params.episode) || "1";

  var data = await httpJson(c.apiBase + "/api/videos/" + encodeURIComponent(p.id) + "/play" + qs({ ep: ep }));
  var url = t((data && data.data && data.data.video_url) || (data && data.video_url) || "");
  if (!url) return [];

  return [{
    name: "蓝果线路",
    description: "第" + ep + "集",
    url: url,
    playerType: "app",
    customHeaders: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
      Referer: "https://languo.ai/",
      "X-Forward-Skip-Redirect-Probe": "1"
    }
  }];
}
