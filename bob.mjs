/*
 * bob (the builder) .mjs
 *
 * Conditionally compiles the extension for either Chrome or Firefox.
 *
 * Required to deal with the fact that I want to build Chromium and Firefox versions,
 * but their respective APIs are becoming increasingly divergent, especially with the
 * move to manifest V3.
 *
 * Outputs the built extension files to ./build, and then optionally zips the build
 * files and/or the source code and places said zips in the current directory, named
 * with the version and browser.
 *
 */

import assert from "node:assert";
import path from "node:path";
import { parseArgs } from "node:util";

import * as esbuild from "esbuild";
import { execa } from "execa";
import fs from "fs-extra";
import { Listr } from "listr2";

const manifestShared = JSON.parse(
	fs.readFileSync("./manifest.shared.json", "utf8"),
);
const manifestChrome = JSON.parse(
	fs.readFileSync("./manifest.chrome.json", "utf8"),
);
const manifestFirefox = JSON.parse(
	fs.readFileSync("./manifest.firefox.json", "utf8"),
);
const packageJson = JSON.parse(fs.readFileSync("./package.json", "utf8"));

const extensionVersion = packageJson.version;
assert(
	extensionVersion === manifestShared.version,
	"package.json and manifest.shared versions match",
);

// TODO: Probably use path library instead of string manipulation?

// Files and directories to copy to the build directory.
const buildFiles = [
	"./images/icons",
	"./src/configui/config.html",
	"./src/popup/popup.css",
	"./src/popup/popup.html",
	"./package.json",
	"./README.md",
	"./LICENSE",
];

// Source files & dirs, specifically for a reviewer.
const sourceFiles = [
	"./docs",
	"./images",
	"./src",
	"./biome.json",
	"./bob.mjs",
	"./LICENSE",
	"./manifest.chrome.json",
	"./manifest.firefox.json",
	"./manifest.shared.json",
	"./bun.lock",
	"./package.json",
	"./postcss.config.cjs",
	"./README.md",
	"./tsconfig.json",
];

// What to run postcss CLI on. NOTE: This and the .html
// <link>s will need to be updated if a new mantine css file is required
const postcss = [
	{
		src: "./node_modules/@mantine/core/styles.css",
		dst: "./build/src/configui/mantine.css",
	},
	{
		src: "./node_modules/@mantine/notifications/styles.css",
		dst: "./build/src/configui/mantine-notifications.css",
	},
	{
		src: "./node_modules/@mantine/core/styles.css",
		dst: "./build/src/popup/mantine.css",
	},
];

const buildPath = "./build";

async function commandExists(command) {
	const result = await execa(command, ["--version"], { reject: false });
	return result.exitCode === 0 && result.failed === false;
}

async function getArchiver() {
	if (await commandExists("7z")) {
		return "7z";
	}

	if (await commandExists("zip")) {
		return "zip";
	}

	if (process.platform === "win32") {
		const result = await execa(
			"powershell",
			["-NoProfile", "-Command", "Get-Command Compress-Archive | Out-Null"],
			{ reject: false },
		);
		if (result.exitCode === 0 && result.failed === false) {
			return "powershell";
		}
	}

	throw new Error(
		"No supported archiver found. Install 7-Zip, use a system 'zip' binary, or run from PowerShell with Compress-Archive available.",
	);
}

function quotePowerShellString(value) {
	return `'${value.replaceAll("'", "''")}'`;
}

async function createZip(archiver, zipName, inputPaths, options = {}) {
	const absoluteZipPath = path.resolve(zipName);
	const cwd = options.cwd;

	if (archiver === "7z") {
		const archiveInputs = cwd
			? inputPaths.map((inputPath) => path.relative(cwd, inputPath))
			: inputPaths;
		return execa("7z", ["a", "-tzip", absoluteZipPath, ...archiveInputs], {
			cwd,
		});
	}

	if (archiver === "zip") {
		const archiveInputs = cwd
			? inputPaths.map((inputPath) => path.relative(cwd, inputPath))
			: inputPaths;
		return execa("zip", ["-r", absoluteZipPath, ...archiveInputs], { cwd });
	}

	if (archiver === "powershell") {
		const archiveInputs = cwd
			? inputPaths.map((inputPath) => path.resolve(cwd, inputPath))
			: inputPaths.map((inputPath) => path.resolve(inputPath));
		const paths = archiveInputs.map(quotePowerShellString).join(", ");
		return execa("powershell", [
			"-NoProfile",
			"-Command",
			`Compress-Archive -Path ${paths} -DestinationPath ${quotePowerShellString(absoluteZipPath)} -Force`,
		]);
	}

	throw new Error(`Unsupported archiver: ${archiver}`);
}

const {
	values: { browser, dev, buildzip, sourcezip },
} = parseArgs({
	strict: true,
	options: {
		// chrome or firefox
		browser: {
			type: "string",
			short: "b",
		},
		// dev mode = set dev=true in code, also don't minify, skip linting, etc.
		dev: {
			type: "boolean",
			short: "d",
			default: false,
		},
		// outputs build zip ready for submission
		buildzip: {
			type: "boolean",
			short: "z",
			default: false,
		},
		// outputs source zip
		sourcezip: {
			type: "boolean",
			short: "s",
			default: false,
		},
	},
});
assert(browser === "chrome" || browser === "firefox", "browser is valid");

if (dev) {
	console.log(
		`🔨 Building for ${browser} (dev enabled, skipping some steps...)`,
	);
} else {
	console.log(`🔨 Building for ${browser}`);
}

const tasks = new Listr([
	{
		title: "Check build requirements",
		task: () =>
			new Listr(
				[
					{
						title: "archiver",
						skip: () => !buildzip && !sourcezip,
						task: async (ctx) => {
							ctx.archiver = await getArchiver();
						},
					},
					{
						title: "git",
						task: () => execa("git", ["--version"]),
					},
				],
				{ concurrent: true },
			),
	},
	{
		title: "Run lint",
		skip: () => dev,
		task: () => execa("bun", ["run", "lint"]),
	},
	{
		title: "Run tsc -noEmit",
		skip: () => dev,
		task: () => execa("bun", ["run", "tsc-noemit"]),
	},
	{
		title: "Setup build directory",
		task: () =>
			new Listr([
				{
					title: "rm",
					skip: async () => !(await fs.existsSync(buildPath)),
					task: () => fs.rm(buildPath, { recursive: true }),
				},
				{
					title: "mkdir",
					task: () => fs.mkdir(buildPath),
				},
			]),
	},
	{
		title: "Get Git info",
		task: async (ctx) => {
			const { stdout } = await execa("git", ["rev-parse", "HEAD"]);
			ctx.gitHeadShortHash = stdout.slice(0, 7);

			const { stdout: status } = await execa("git", ["status", "--porcelain"]);
			ctx.gitState = status.trim() === "" ? "clean" : "dirty";
		},
	},
	{
		// Do this before running esbuild so we can insert the correct host URLs.
		title: "Merge manifests",
		task: (ctx) => {
			ctx.manifest = browser === "chrome" ? manifestChrome : manifestFirefox;

			// Object merge isn't deep, so manually merge permission stuff.
			const mergedPermissions = [
				...manifestShared.permissions,
				...ctx.manifest.permissions,
			];

			// Overwrite shared settings with browser based values.
			ctx.manifest = {
				...manifestShared,
				...ctx.manifest,
			};

			ctx.manifest.permissions = mergedPermissions;
		},
	},
	{
		title: "Convert host permissions to URLs",
		task: (ctx) => {
			// This is something ChatGPT came up with!
			// This description may not be 100% accurate:
			// ^\*?:?\/\/ Matches the beginning of the URL (including an optional protocol).
			// (?:\*\.)? Matches an optional *. subdomain wildcard.
			// ([^/]+) Captures the hostname; any sequence of characters that is not a forward slash.
			// (?:\/|$) Matches the end of the URL (either a forward slash or the end of the string).
			ctx.hostPermissionUrls = ctx.manifest.host_permissions.map(
				(permission) => {
					const match = permission.match(/^\*?:?\/\/(?:\*\.)?([^/]+)(?:\/|$)/);
					return match ? match[1] : null;
				},
			);
		},
	},
	{
		title: "Run esbuild",
		task: (ctx) => {
			const scriptPaths = [
				"./src/background/main.ts",
				"./src/configui/config.tsx",
				"./src/popup/popup.tsx",
			];
			const opts = {
				entryPoints: scriptPaths,
				outdir: `${buildPath}/src`,
				bundle: true,
				logLevel: "error",
				platform: "browser",
				define: {
					"process.env.browser": `'${browser}'`,
					"process.env.dev": `${dev}`,
					"process.env.version": `'${extensionVersion}'`,
					"process.env.gitShortHash": `'${ctx.gitHeadShortHash}'`,
					"process.env.gitState": `'${ctx.gitState}'`,
					"process.env.buildTime": JSON.stringify(new Date()),
					"process.env.hostPermissions": JSON.stringify(
						ctx.manifest.host_permissions,
					),
					"process.env.hostPermissionUrls": JSON.stringify(
						ctx.hostPermissionUrls,
					),
				},
			};

			let additions = {};
			if (!dev) {
				additions = {
					minify: true,
				};
			}

			return esbuild.build({
				...opts,
				...additions,
			});
		},
	},
	{
		title: "Run PostCSS",
		task: async () => {
			const calls = [];
			for (const { src, dst } of postcss) {
				calls.push(execa("bunx", ["postcss", src, "-o", dst]));
			}
			return Promise.all(calls);
		},
	},
	{
		title: "Copy static files",
		task: async () => {
			const copies = [];
			for (const path of buildFiles) {
				copies.push(fs.copy(path, path.replace("./", `${buildPath}/`)));
			}
			return Promise.all(copies);
		},
	},
	{
		title: "Write manifest",
		task: (ctx) => {
			const manifestString = JSON.stringify(ctx.manifest, null, 2);
			return fs.writeFile(`${buildPath}/manifest.json`, manifestString);
		},
	},
	{
		title: "Create build zip file",
		skip: () => !buildzip,
		task: async (ctx) => {
			const zipName = `custombangsearch-${browser}-${extensionVersion}-${ctx.gitHeadShortHash}-${ctx.gitState}.zip`;
			const buildEntries = await fs.readdir(buildPath);
			const buildInputs = buildEntries.map((entry) =>
				path.join(buildPath, entry),
			);
			return createZip(ctx.archiver, zipName, buildInputs, { cwd: buildPath });
		},
	},
	{
		title: "Create source zip file",
		skip: () => !sourcezip,
		task: (ctx) => {
			const zipName = `custombangsearch-${browser}-${extensionVersion}-${ctx.gitHeadShortHash}-${ctx.gitState}-source.zip`;
			return createZip(ctx.archiver, zipName, sourceFiles);
		},
	},
]);

tasks.run().catch((err) => {
	console.error(err);
});
