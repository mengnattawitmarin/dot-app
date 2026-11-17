export type Genre = "ambient" | "electronic" | "pop" | "jazz" | "world" | "thai";

export type StudioPreset = "night-drive" | "loft" | "focus" | "club" | "after" | "rain";

export type SceneId = "rain" | "drive" | "ocean" | "blocks" | "horizon" | "grain";

export type LiveStation = {
  id: string;
  kind: "live";
  name: string;
  city: string;
  blurb: string;
  genre: Genre;
  urls: string[];
  fallback: StudioPreset;
};

export type StudioStation = {
  id: string;
  kind: "studio";
  name: string;
  city: string;
  blurb: string;
  genre: Genre;
  preset: StudioPreset;
};

export type Station = LiveStation | StudioStation;

export type TvChannel = {
  id: string;
  name: string;
  blurb: string;
  mode: "video" | "scene";
  src?: string;
  hls?: boolean;
  scene?: SceneId;
  region?: "th";
  /** shown in the "ช่องยอดนิยม" row */
  popular?: boolean;
};

export type TitleKind = "movie" | "short" | "series";

export type Title = {
  id: string;
  name: string;
  tagline: string;
  kind: TitleKind;
  year: number;
  minutes: number;
  rating: number;
  src: string;
  /** two-stop gradient for the generated poster */
  palette: [string, string];
  scene: SceneId;
  tags: Array<"new" | "popular" | "featured">;
};

export type Reel = {
  id: string;
  thought: string;
  author: string;
  scene: SceneId;
  src?: string;
  likes: number;
};

export const GENRE_LABEL: Record<Genre, string> = {
  ambient: "แอมเบียนต์",
  electronic: "อิเล็กทรอนิกส์",
  pop: "ป๊อป",
  jazz: "แจ๊ส",
  world: "โลก",
  thai: "ไทย",
};

function soma(mount: string): string[] {
  return [1, 2].map((n) => `https://ice${n}.somafm.com/${mount}-128-mp3`);
}

export const stations: Station[] = [
  {
    id: "studio-drive",
    kind: "studio",
    name: "มิดไนท์ไดรฟ์",
    city: "ในเครื่อง",
    blurb: "เบสช้า ถนนว่าง ไม่ต้องใช้เน็ต",
    genre: "electronic",
    preset: "night-drive",
  },
  {
    id: "studio-loft",
    kind: "studio",
    name: "ลอฟต์",
    city: "ในเครื่อง",
    blurb: "คอร์ดอุ่นกับเสียงแผ่น",
    genre: "pop",
    preset: "loft",
  },
  {
    id: "studio-focus",
    kind: "studio",
    name: "โฟกัส",
    city: "ในเครื่อง",
    blurb: "โดรนนิ่งสำหรับอ่านหนังสือ",
    genre: "ambient",
    preset: "focus",
  },
  {
    id: "studio-club",
    kind: "studio",
    name: "คลับโฟลว์",
    city: "ในเครื่อง",
    blurb: "จังหวะสี่บนพื้น",
    genre: "electronic",
    preset: "club",
  },
  {
    id: "studio-after",
    kind: "studio",
    name: "อาฟเตอร์อาวส์",
    city: "ในเครื่อง",
    blurb: "เดินเบสช้าหลังร้านปิด",
    genre: "jazz",
    preset: "after",
  },
  {
    id: "studio-rain",
    kind: "studio",
    name: "ฝนบนกระจก",
    city: "ในเครื่อง",
    blurb: "ฝนเมืองกับกระดิ่งบางๆ",
    genre: "world",
    preset: "rain",
  },
  {
    id: "th-cool",
    kind: "live",
    name: "COOL Fahrenheit 93",
    city: "กรุงเทพฯ",
    blurb: "เพลงไทยและสากล",
    genre: "thai",
    urls: [
      "https://coolism-web.cdn.byteark.com/;stream/1",
      "https://coolism-web3rd.cdn.byteark.com/stream/1/",
    ],
    fallback: "loft",
  },
  {
    id: "th-flex",
    kind: "live",
    name: "Flex 104.5",
    city: "กรุงเทพฯ",
    blurb: "เพลงวัยรุ่น",
    genre: "thai",
    urls: ["https://streaming.flexconnect.net/voiceflex/voiceflex/playlist.m3u8"],
    fallback: "loft",
  },
  {
    id: "th-bkk",
    kind: "live",
    name: "BKK.FM",
    city: "กรุงเทพฯ",
    blurb: "อินดี้และแดนซ์",
    genre: "thai",
    urls: ["https://rsas.bkk.fm/radio"],
    fallback: "night-drive",
  },
  {
    id: "th-chili",
    kind: "live",
    name: "Chili Classics",
    city: "ไทย",
    blurb: "เพลงคลาสสิก",
    genre: "thai",
    urls: ["https://stream.chiliradio.app/chiliclassics"],
    fallback: "loft",
  },
  {
    id: "th-red",
    kind: "live",
    name: "Radio Red",
    city: "ภูเก็ต",
    blurb: "เพลงชายหาด",
    genre: "thai",
    urls: ["https://stream.chiliradio.app/radiored"],
    fallback: "loft",
  },
  {
    id: "th-looktung",
    kind: "live",
    name: "ลูกทุ่ง Eingdoi",
    city: "ไทย",
    blurb: "ลูกทุ่ง",
    genre: "thai",
    urls: ["https://inter.lannaradio.com/radio/8000/radio.mp3"],
    fallback: "after",
  },
  {
    id: "th-banmai",
    kind: "live",
    name: "บ้านใหม่ เรดิโอ",
    city: "กรุงเทพฯ",
    blurb: "FM 93.5 เพลงไทย",
    genre: "thai",
    urls: ["https://radio10.plathong.net/7590/;stream.mp3"],
    fallback: "loft",
  },
  {
    id: "th-fm91",
    kind: "live",
    name: "FM 91",
    city: "กรุงเทพฯ",
    blurb: "เพลงร่วมสมัย",
    genre: "thai",
    urls: ["https://www.fm91bkk.com:8900/;stream.mp3"],
    fallback: "loft",
  },
  {
    id: "th-pattaya",
    kind: "live",
    name: "City Radio Pattaya",
    city: "พัทยา",
    blurb: "เพลงเมืองท่องเที่ยว",
    genre: "thai",
    urls: ["https://media.onair.one:8200/stream/1/"],
    fallback: "loft",
  },
  {
    id: "th-thinking",
    kind: "live",
    name: "96.5 Thinking",
    city: "กรุงเทพฯ",
    blurb: "ข่าวและความคิด MCOT",
    genre: "thai",
    urls: ["https://live-org-01-cdn.mcot.net/radiocdn_edge/fm965.stream_aac/playlist.m3u8"],
    fallback: "focus",
  },
  {
    id: "th-mcot1005",
    kind: "live",
    name: "MCOT News 100.5",
    city: "กรุงเทพฯ",
    blurb: "ข่าวเครือข่าย",
    genre: "thai",
    urls: ["https://play-fm1005.mcot.net/fm1005/fm1005.m3u8"],
    fallback: "focus",
  },
  {
    id: "th-family",
    kind: "live",
    name: "106 ครอบครัวข่าว",
    city: "กรุงเทพฯ",
    blurb: "ข่าวสาร",
    genre: "thai",
    urls: ["https://radio11.plathong.net/7138/;stream.mp3"],
    fallback: "focus",
  },
  {
    id: "th-keangun",
    kind: "live",
    name: "เขียนกันเรดิโอ",
    city: "ไทย",
    blurb: "ทอล์ก",
    genre: "thai",
    urls: ["https://radio9.plathong.net/7054/;stream.mp3"],
    fallback: "after",
  },
  {
    id: "th-loei",
    kind: "live",
    name: "MCOT เลย",
    city: "เลย",
    blurb: "FM 100 สถานีภูมิภาค",
    genre: "thai",
    urls: ["https://lb-media.mcot.net/RegionRadio/Loei.stream_aac/playlist.m3u8"],
    fallback: "loft",
  },
  {
    id: "live-groove",
    kind: "live",
    name: "Groove Salad",
    city: "ซานฟรานซิสโก",
    blurb: "แอมเบียนต์ชิลล์จาก SomaFM",
    genre: "ambient",
    urls: soma("groovesalad"),
    fallback: "loft",
  },
  {
    id: "live-vapor",
    kind: "live",
    name: "Vaporwaves",
    city: "ซานฟรานซิสโก",
    blurb: "เวเปอร์ย้อนยุค",
    genre: "electronic",
    urls: soma("vaporwaves"),
    fallback: "night-drive",
  },
  {
    id: "live-trip",
    kind: "live",
    name: "The Trip",
    city: "ซานฟรานซิสโก",
    blurb: "ไซเคเดลิกช้า",
    genre: "ambient",
    urls: soma("thetrip"),
    fallback: "focus",
  },
  {
    id: "live-defcon",
    kind: "live",
    name: "DEF CON",
    city: "ซานฟรานซิสโก",
    blurb: "อิเล็กทรอนิกส์มืด",
    genre: "electronic",
    urls: soma("defcon"),
    fallback: "club",
  },
  {
    id: "live-poptron",
    kind: "live",
    name: "PopTron",
    city: "ซานฟรานซิสโก",
    blurb: "ป๊อปซินธ์",
    genre: "pop",
    urls: soma("poptron"),
    fallback: "loft",
  },
  {
    id: "live-indie",
    kind: "live",
    name: "Indie Pop Rocks",
    city: "ซานฟรานซิสโก",
    blurb: "อินดี้กีตาร์",
    genre: "pop",
    urls: soma("indiepop"),
    fallback: "loft",
  },
  {
    id: "live-agent",
    kind: "live",
    name: "Secret Agent",
    city: "ซานฟรานซิสโก",
    blurb: "แจ๊สสายลับ",
    genre: "jazz",
    urls: soma("secretagent"),
    fallback: "after",
  },
  {
    id: "live-lush",
    kind: "live",
    name: "Lush",
    city: "ซานฟรานซิสโก",
    blurb: "โวคอลนุ่ม",
    genre: "pop",
    urls: soma("lush"),
    fallback: "loft",
  },
  {
    id: "live-beat",
    kind: "live",
    name: "Beat Blender",
    city: "ซานฟรานซิสโก",
    blurb: "เฮาส์ดาวน์เทมโป",
    genre: "electronic",
    urls: soma("beatblender"),
    fallback: "club",
  },
  {
    id: "live-dub",
    kind: "live",
    name: "Dub Step Beyond",
    city: "ซานฟรานซิสโก",
    blurb: "เบสหนัก",
    genre: "electronic",
    urls: soma("dubstep"),
    fallback: "club",
  },
  {
    id: "live-cliq",
    kind: "live",
    name: "Cliqhop",
    city: "ซานฟรานซิสโก",
    blurb: "ฮิปฮอปอิเล็กทรอนิกส์",
    genre: "electronic",
    urls: soma("cliqhop"),
    fallback: "club",
  },
  {
    id: "live-deep",
    kind: "live",
    name: "Deep Space One",
    city: "ซานฟรานซิสโก",
    blurb: "อวกาศลึก",
    genre: "ambient",
    urls: soma("deepspaceone"),
    fallback: "focus",
  },
  {
    id: "live-drone",
    kind: "live",
    name: "Drone Zone",
    city: "ซานฟรานซิสโก",
    blurb: "โดรนสมาธิ",
    genre: "ambient",
    urls: soma("dronezone"),
    fallback: "focus",
  },
  {
    id: "live-digitalis",
    kind: "live",
    name: "Digitalis",
    city: "ซานฟรานซิสโก",
    blurb: "แอมเบียนต์ดิจิทัล",
    genre: "electronic",
    urls: soma("digitalis"),
    fallback: "night-drive",
  },
  {
    id: "live-n5",
    kind: "live",
    name: "n5MD",
    city: "ซานฟรานซิสโก",
    blurb: "โพสต์ร็อกนุ่ม",
    genre: "pop",
    urls: soma("n5md"),
    fallback: "loft",
  },
  {
    id: "live-80s",
    kind: "live",
    name: "Underground 80s",
    city: "ซานฟรานซิสโก",
    blurb: "ป๊อปยุค 80",
    genre: "pop",
    urls: soma("u80s"),
    fallback: "loft",
  },
  {
    id: "live-rp",
    kind: "live",
    name: "Radio Paradise",
    city: "แคลิฟอร์เนีย",
    blurb: "มิกซ์อิสระทั้งวัน",
    genre: "pop",
    urls: ["https://stream.radioparadise.com/mp3-128"],
    fallback: "loft",
  },
  {
    id: "live-goa",
    kind: "live",
    name: "Suburbs of Goa",
    city: "ซานฟรานซิสโก",
    blurb: "โลกและเบส",
    genre: "world",
    urls: soma("suburbsofgoa"),
    fallback: "rain",
  },
  {
    id: "live-sonic",
    kind: "live",
    name: "Sonic Universe",
    city: "ซานฟรานซิสโก",
    blurb: "แจ๊สทดลอง",
    genre: "jazz",
    urls: soma("sonicuniverse"),
    fallback: "after",
  },
  {
    id: "live-folk",
    kind: "live",
    name: "Folk Forward",
    city: "ซานฟรานซิสโก",
    blurb: "โฟล์กใหม่",
    genre: "pop",
    urls: soma("folkfwd"),
    fallback: "loft",
  },
];

export const channels: TvChannel[] = [
  {
    id: "local-rain",
    name: "ฝนบนกระจก",
    blurb: "รายการในเครื่อง",
    mode: "scene",
    scene: "rain",
  },
  {
    id: "local-drive",
    name: "ถนนกลางคืน",
    blurb: "รายการในเครื่อง",
    mode: "scene",
    scene: "drive",
  },
  {
    id: "local-ocean",
    name: "มหาสมุทร",
    blurb: "รายการในเครื่อง",
    mode: "scene",
    scene: "ocean",
  },
  {
    id: "local-city",
    name: "เมืองกระดาษ",
    blurb: "รายการในเครื่อง",
    mode: "scene",
    scene: "blocks",
  },
  {
    id: "local-moon",
    name: "พระจันทร์ช่อง",
    blurb: "รายการในเครื่อง",
    mode: "scene",
    scene: "horizon",
  },
  {
    id: "local-ident",
    name: "สัญญาณ Do.T",
    blurb: "นาฬิกาสถานี",
    mode: "scene",
    scene: "grain",
  },
  {
    id: "tv-ch5",
    popular: true,
    name: "ช่อง 5",
    blurb: "สถานีวิทยุโทรทัศน์กองทัพบก",
    mode: "video",
    hls: true,
    region: "th",
    src: "https://nodelive.thaitv5hd.com/hls/tv5hdlive-for-thaitv5hdcom/stream_0.m3u8",
  },
  {
    id: "tv-nbt",
    popular: true,
    name: "NBT 2HD",
    blurb: "สถานีวิทยุโทรทัศน์แห่งประเทศไทย",
    mode: "video",
    hls: true,
    region: "th",
    src: "https://cdn-edge.iiptvcdn.com/live_event/smil:f180-054a-38d7-ce66-f7cf.smil/playlist.m3u8",
  },
  {
    id: "tv-topnews",
    popular: true,
    name: "ท็อปนิวส์",
    blurb: "ข่าว",
    mode: "video",
    hls: true,
    region: "th",
    src: "https://live.topnews.co.th/hls/topnews_a_720.m3u8",
  },
  {
    id: "tv-cool",
    popular: true,
    name: "Cool Channel",
    blurb: "เพลง",
    mode: "video",
    hls: true,
    region: "th",
    src: "https://live-iptv.cool-channel.com/cool/live-720P.m3u8",
  },
  {
    id: "tv-siam",
    name: "13 สยามไทย",
    blurb: "บันเทิงท้องถิ่น",
    mode: "video",
    hls: true,
    region: "th",
    src: "https://live.x2.co.th/live/13livetv-th.m3u8",
  },
  {
    id: "tv-parliament",
    name: "รัฐสภา",
    blurb: "ถ่ายทอดการประชุม",
    mode: "video",
    hls: true,
    region: "th",
    src: "https://tv-live.tpchannel.org/live/tv.m3u8",
  },
  {
    id: "tv-stou",
    name: "มสธ.",
    blurb: "มหาวิทยาลัยสุโขทัยธรรมาธิราช",
    mode: "video",
    hls: true,
    region: "th",
    src: "https://stream1.stou.ac.th/live/stou_720p/playlist.m3u8",
  },
  {
    id: "tv-dltv1",
    name: "DLTV 1",
    blurb: "การศึกษาทางไกล อนุบาล",
    mode: "video",
    hls: true,
    region: "th",
    src: "https://cdn-live.dltv.ac.th/dltv01.m3u8",
  },
  {
    id: "tv-dltv5",
    name: "DLTV 5",
    blurb: "การศึกษาทางไกล ประถม",
    mode: "video",
    hls: true,
    region: "th",
    src: "https://cdn-live.dltv.ac.th/dltv05.m3u8",
  },
  {
    id: "tv-dltv10",
    name: "DLTV 10",
    blurb: "การศึกษาทางไกล มัธยม",
    mode: "video",
    hls: true,
    region: "th",
    src: "https://cdn-live.dltv.ac.th/dltv10.m3u8",
  },
  {
    id: "tv-nasa",
    name: "NASA TV",
    blurb: "ถ่ายทอดสดอวกาศ",
    mode: "video",
    hls: true,
    src: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8",
  },
];

/**
 * Open-licence films only (Blender Foundation / W3C samples).
 * Commercial titles need a licensed catalogue + DRM before they can ship.
 */
export const titles: Title[] = [
  {
    id: "mv-bbb",
    name: "Big Buck Bunny",
    tagline: "กระต่ายยักษ์ใจดี กับแผนเอาคืนสุดป่วน",
    kind: "movie",
    year: 2008,
    minutes: 10,
    rating: 8.4,
    src: "https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4",
    palette: ["#3d5a1e", "#0d1405"],
    scene: "horizon",
    tags: ["featured", "popular"],
  },
  {
    id: "mv-sintel",
    name: "Sintel",
    tagline: "หญิงสาวออกตามหามังกรน้อยที่หายไป",
    kind: "movie",
    year: 2010,
    minutes: 1,
    rating: 8.9,
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    palette: ["#6b3a1c", "#120805"],
    scene: "rain",
    tags: ["featured", "popular", "new"],
  },
  {
    id: "mv-elephants",
    name: "Elephants Dream",
    tagline: "โลกเครื่องจักรที่ไม่มีวันหยุดหมุน",
    kind: "movie",
    year: 2006,
    minutes: 11,
    rating: 7.6,
    src: "https://archive.org/download/ElephantsDream/ed_1024_512kb.mp4",
    palette: ["#1f3c4d", "#05090c"],
    scene: "blocks",
    tags: ["popular"],
  },
  {
    id: "mv-spring",
    name: "Spring",
    tagline: "สาวเลี้ยงแกะกับวิญญาณแห่งฤดูใบไม้ผลิ",
    kind: "short",
    year: 2019,
    minutes: 8,
    rating: 8.7,
    src: "https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a5/Spring_-_Blender_Open_Movie.webm/Spring_-_Blender_Open_Movie.webm.480p.vp9.webm",
    palette: ["#2c4a3a", "#060b08"],
    scene: "ocean",
    tags: ["new", "featured"],
  },
  {
    id: "mv-bunny-trailer",
    name: "Bunny Trailer",
    tagline: "ตัวอย่างสั้นก่อนดูเต็มเรื่อง",
    kind: "short",
    year: 2008,
    minutes: 1,
    rating: 7.9,
    src: "https://media.w3.org/2010/05/bunny/trailer.mp4",
    palette: ["#5a4a1a", "#0e0b04"],
    scene: "drive",
    tags: ["new"],
  },
  {
    id: "mv-flower",
    name: "Flower",
    tagline: "ดอกไม้บานในหนึ่งลมหายใจ",
    kind: "short",
    year: 2020,
    minutes: 1,
    rating: 7.2,
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    palette: ["#5a1f3a", "#0e0509"],
    scene: "grain",
    tags: ["new"],
  },
];

export function getTitle(id: string): Title | undefined {
  return titles.find((t) => t.id === id);
}

export const reels: Reel[] = [
  {
    id: "reel-1",
    thought: "เมืองนี้ดังกว่าความคิดในหัวแค่หนึ่งเพลง",
    author: "mira",
    scene: "rain",
    src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    likes: 128,
  },
  {
    id: "reel-2",
    thought: "พิมพ์แล้วยังไม่ส่ง เพลงเดิมวนรอบที่สาม",
    author: "koi",
    scene: "drive",
    src: "https://media.w3.org/2010/05/bunny/trailer.mp4",
    likes: 86,
  },
  {
    id: "reel-3",
    thought: "ฝนทำให้ไฟถนนดูแพงขึ้น",
    author: "nite",
    scene: "horizon",
    src: "https://media.w3.org/2010/05/sintel/trailer.mp4",
    likes: 240,
  },
  {
    id: "reel-4",
    thought: "นั่งรถคันสุดท้าย แล้วแกล้งลืมว่าต้องลง",
    author: "bus",
    scene: "ocean",
    src: "https://media.w3.org/2010/05/video/movie_300.mp4",
    likes: 64,
  },
  {
    id: "reel-5",
    thought: "ห้องมืดพอดีสำหรับคนที่ยังไม่อยากตอบ",
    author: "film",
    scene: "blocks",
    likes: 41,
  },
  {
    id: "reel-6",
    thought: "เก็บความเงียบไว้เป็นเพลย์ลิสต์",
    author: "solo",
    scene: "grain",
    likes: 19,
  },
  {
    id: "reel-7",
    thought: "ทุกคนดูเร่ง ยกเว้นคนที่ใส่หูฟัง",
    author: "koi",
    scene: "drive",
    likes: 77,
  },
  {
    id: "reel-8",
    thought: "พรุ่งนี้ค่อยเป็นคนเก่ง วันนี้ขอแค่เพลงนี้",
    author: "mira",
    scene: "rain",
    likes: 53,
  },
];

export function getStation(id: string): Station | undefined {
  return stations.find((s) => s.id === id);
}

export function getStudioByPreset(preset: StudioPreset): StudioStation {
  const found = stations.find(
    (s): s is StudioStation => s.kind === "studio" && s.preset === preset,
  );
  return found ?? (stations[0] as StudioStation);
}

export function getChannel(id: string): TvChannel | undefined {
  return channels.find((c) => c.id === id);
}

export function getReel(id: string): Reel | undefined {
  return reels.find((r) => r.id === id);
}

export function mark(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "O";
  const latin = /^[A-Za-z0-9]/.test(first);
  if (!latin) return first.slice(0, 1);
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  return (first[0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function stationQueue(offline: boolean): Station[] {
  const local = stations.filter((station) => station.kind === "studio");
  if (offline) return local;
  const live = stations.filter((station) => station.kind === "live");
  return [...live, ...local];
}
