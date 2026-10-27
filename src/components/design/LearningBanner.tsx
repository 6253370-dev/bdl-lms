import summit from "@/assets/learning-summit.jpg";

export function LearningBanner() {
  return (
    <div className="learning-banner relative isolate min-h-36 overflow-hidden rounded-lg">
      <img src={summit} alt="" width={1536} height={512} loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <div className="max-w-[65%] p-6 sm:p-8">
        <p className="font-display text-xl font-bold leading-snug">Hər yeni bilik<br />səni daha güclü edir!</p>
        <p className="mt-2 text-xs text-muted-foreground">Öyrənmək bir vərdişdir, həyat tərzidir.</p>
      </div>
    </div>
  );
}