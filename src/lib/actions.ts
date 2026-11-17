import { getChannel, getTitle, type TvChannel } from "@/lib/catalog";
import { stopForOtherOutput } from "@/lib/player";
import { selectOffline, useApp } from "@/lib/store";

export function openTitle(id: string) {
  const title = getTitle(id);
  if (!title) return;
  if (selectOffline(useApp.getState())) {
    useApp.getState().toast("ภาพยนตร์ต้องใช้อินเทอร์เน็ต");
    return;
  }
  stopForOtherOutput();
  const app = useApp.getState();
  app.setOutput("video");
  app.setActiveTitle(title.id);
  app.pushRecent(title.id);
}

export function closeTitle() {
  const app = useApp.getState();
  app.setActiveTitle(null);
  if (app.output === "video") app.setOutput("idle");
}

export function openChannel(channelOrId: TvChannel | string) {
  const channel = typeof channelOrId === "string" ? getChannel(channelOrId) : channelOrId;
  if (!channel) return;
  if (channel.mode === "video" && selectOffline(useApp.getState())) {
    useApp.getState().toast("ช่องนี้ต้องใช้อินเทอร์เน็ต ลองช่องในเครื่อง");
    return;
  }
  stopForOtherOutput();
  const app = useApp.getState();
  app.setOutput("tv");
  app.setActiveChannel(channel.id);
  app.pushRecent(channel.id);
}

export function closeChannel() {
  const app = useApp.getState();
  app.setActiveChannel(null);
  if (app.output === "tv") app.setOutput("idle");
}
