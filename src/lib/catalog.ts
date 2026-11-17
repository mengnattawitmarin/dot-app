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
  /** FM frequency shown on the artwork, e.g. "93.0" (parsed from the name when absent) */
  freq?: string;
  /** "radio-browser" for stations loaded from the online directory */
  source?: "radio-browser";
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

export type Clip = {
  id: string;
  src: string;
  /** seconds — play only this segment of a longer film, looping */
  start?: number;
  end?: number;
  author: string;
  caption: string;
  /** source credit shown on the music line (CC BY attribution) */
  credit: string;
  likes: number;
  comments: number;
  shares: number;
  /** set for clips the user recorded / uploaded on this device */
  mine?: boolean;
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

/** Short-video feed for Clipper. Segments of open films (Blender Foundation, CC BY) + CC0 samples. */
export const clips: Clip[] = [
  { id: "clip-bbb-morning", src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", start: 12, end: 40, author: "bunnyverse", caption: "เช้าวันใหม่ในป่า ใครตื่นก่อนได้กินก่อน 🌳🐰", credit: "Big Buck Bunny", likes: 12400, comments: 318, shares: 92 },
  { id: "clip-sintel-quest", src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4", start: 95, end: 125, author: "dragonseeker", caption: "ออกเดินทางคนเดียว เพื่อตามหาเพื่อนที่หายไป 🐉 #ภารกิจ", credit: "Sintel", likes: 30500, comments: 1204, shares: 860 },
  { id: "clip-tos-city", src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4", start: 182, end: 210, author: "steel.ams", caption: "อัมสเตอร์ดัมในอนาคต หุ่นยนต์เต็มเมือง 🤖⚡", credit: "Tears of Steel", likes: 8800, comments: 241, shares: 77 },
  { id: "clip-flower", src: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", author: "mira", caption: "ดอกไม้บานในหนึ่งลมหายใจ 🌸 เมืองนี้ดังกว่าความคิดในหัวแค่หนึ่งเพลง", credit: "CC0", likes: 5120, comments: 88, shares: 40 },
  { id: "clip-ed-machine", src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4", start: 60, end: 90, author: "proog", caption: "โลกเครื่องจักรที่ไม่เคยหยุดหมุน ⚙️ ดูจนจบแล้วจะงง", credit: "Elephants Dream", likes: 4300, comments: 156, shares: 31 },
  { id: "clip-bbb-prank", src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", start: 170, end: 198, author: "bunnyverse", caption: "เมื่อโดนแกล้งเป็นครั้งที่สาม… ความอดทนมีขีดจำกัด 😤", credit: "Big Buck Bunny", likes: 21900, comments: 640, shares: 410 },
  { id: "clip-sintel-trailer", src: "https://media.w3.org/2010/05/sintel/trailer.mp4", author: "nite", caption: "ฝนทำให้ไฟถนนดูแพงขึ้น ✨ ตัวอย่างที่ดูกี่รอบก็ขนลุก", credit: "Sintel", likes: 15200, comments: 402, shares: 133 },
  { id: "clip-tos-fight", src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4", start: 440, end: 468, author: "steel.ams", caption: "ฉากบู๊ที่รอมาทั้งเรื่อง 🔥", credit: "Tears of Steel", likes: 17700, comments: 520, shares: 301 },
  { id: "clip-bunny-trailer", src: "https://media.w3.org/2010/05/bunny/trailer.mp4", author: "koi", caption: "พิมพ์แล้วยังไม่ส่ง เพลงเดิมวนรอบที่สาม 🎧", credit: "Big Buck Bunny", likes: 6400, comments: 97, shares: 25 },
  { id: "clip-bbb-finale", src: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", start: 452, end: 482, author: "bunnyverse", caption: "ไคลแมกซ์! แผนเอาคืนสำเร็จ 😎 #ห้ามพลาด", credit: "Big Buck Bunny", likes: 40200, comments: 2100, shares: 1500 },
];

export function getClip(id: string): Clip | undefined {
  return clips.find((c) => c.id === id);
}

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

/** FM frequency from an explicit field or the station name (87.5–108). */
export function stationFreq(station: Station): string | null {
  if (station.kind === "live" && station.freq) return station.freq;
  const m = station.name.match(/(?:^|[^\d.])(\d{2,3}(?:\.\d{1,2})?)(?![\d.])/);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return n >= 87.5 && n <= 108 ? m[1] : null;
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
