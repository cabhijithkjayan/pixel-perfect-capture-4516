import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

type GateData = { unlocked?: boolean };

function sessionConfig() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("Session configuration is missing");
  return {
    password,
    name: "tips-access",
    maxAge: 60 * 60 * 24 * 7,
    cookie: { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" },
  };
}

export const isUnlocked = createServerOnlyFn(async () => {
  const session = await useSession<GateData>(sessionConfig());
  return session.data.unlocked === true;
});

export const getAccessStatus = createServerFn({ method: "GET" }).handler(async () => ({
  unlocked: await isUnlocked(),
}));

export const unlockSite = createServerFn({ method: "POST" })
  .inputValidator((data: { sequence: string }) => data)
  .handler(async ({ data }) => {
    const expected = "PITS";
    const receivedHash = createHash("sha256").update(data.sequence, "utf8").digest();
    const expectedHash = createHash("sha256").update(expected, "utf8").digest();
    if (!timingSafeEqual(receivedHash, expectedHash)) return { ok: false as const };
    const session = await useSession<GateData>(sessionConfig());
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockSite = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<GateData>(sessionConfig());
  await session.clear();
  return { ok: true as const };
});
