import { useEffect } from "react";
import { loadDharma, openDharmaLater, useDharma } from "@/lib/dharma";
import { useApp } from "@/lib/store";
import { TeacherEmblem } from "@/components/dharma-view";
import { SectionHeader } from "@/components/ui";

/** Home-screen teaser for the ธรรมะ mode: one emblem per teacher. */
export function DharmaRow() {
  const teachers = useDharma((s) => s.teachers);
  useEffect(() => {
    void loadDharma();
  }, []);
  if (teachers.length === 0) return null;
  return (
    <section className="mt-7">
      <SectionHeader title="ฟังธรรมะ" onAction={() => useApp.getState().setTab("dharma")} />
      <div className="no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4">
        {teachers.map((t) => (
          <button key={t.id} type="button" onClick={() => {
              openDharmaLater({ kind: "teacher", id: t.id });
              useApp.getState().setTab("dharma");
            }}
            className="w-[72px] shrink-0 text-center">
            <TeacherEmblem teacher={t} className="mx-auto size-16 text-lg" />
            <span className="mt-1.5 line-clamp-2 block text-[11px] leading-tight text-muted">{t.name}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
