import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000,
    expect: {
        timeout: 20_000,
    },
    fullyParallel: false,
    retries: 0,
    reporter: [["line"]],
    use: {
        baseURL: process.env.SMOKE_BASE_URL || "https://autoapply.works",
        trace: "retain-on-failure",
    },
});
