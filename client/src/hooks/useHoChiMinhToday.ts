import { useEffect, useState } from "react";
import { millisecondsUntilNextHoChiMinhDay, todayInHoChiMinh } from "../utils/date";

export function useHoChiMinhToday(): string {
  const [today, setToday] = useState(() => todayInHoChiMinh());

  useEffect(() => {
    let timer: number | undefined;

    const refreshAndSchedule = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      const now = new Date();
      setToday((current) => {
        const next = todayInHoChiMinh(now);
        return next === current ? current : next;
      });
      timer = window.setTimeout(refreshAndSchedule, millisecondsUntilNextHoChiMinhDay(now));
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshAndSchedule();
    };

    refreshAndSchedule();
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshAndSchedule);
    window.addEventListener("pageshow", refreshAndSchedule);
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshAndSchedule);
      window.removeEventListener("pageshow", refreshAndSchedule);
    };
  }, []);

  return today;
}
