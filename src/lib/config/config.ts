// Must be an integer
export const currentConfigVersion = 6;

// TODO: Custom sync server?
export type allowedStorageMethodsAsType = "sync" | "local";

export const allowedStorageMethodsAsArray: Array<allowedStorageMethodsAsType> =
	["sync", "local"];

export interface Options {
	// The character(s) to trigger the extension
	trigger: string;
	// The storage method for config
	storageMethod: allowedStorageMethodsAsType;
	// Search engine domains to ignore, e.g. searx.tiekoetter.com
	ignoredSearchDomains: string[];
	// If true, ignore bang case
	ignoreBangCase: boolean;
	// If true, treat keyboard-layout equivalents as the same bang
	ignoreBangKeyboardLayout: boolean;
	// TODO: Support this?
	// If non-empty, this is used to split queries into multiple searches on every URL
	// querySeparator: string;
}

export const defaultOptions: Readonly<Options> = {
	trigger: "!",
	storageMethod: "sync",
	ignoredSearchDomains: [],
	ignoreBangCase: false,
	ignoreBangKeyboardLayout: false,
};

export interface UrlInfo {
	// Hidden to the user, uniquely identifies this URL (mainly useful for the React code)
	id: string;
	// A URL
	url: string;
}

export interface BangInfo {
	// Hidden to the user, uniquely identifies this bang (mainly useful for the React code)
	id: string;
	// The actual bang
	keyword: string;
	// If set, ignore URLs and use the URLs set for the bang with this keyword
	alias: string | null;
	// If the keyword is used without query, override the default location with this
	defaultUrl: string;
	// Associated URLs
	urls: Array<UrlInfo>;
	// If true, bypass URL encoding of query string
	dontEncodeQuery: boolean;
}

export interface Config {
	version: number;
	options: Options;
	bangs: BangInfo[];
}

// The same as BangInfo with all the "id" fields omitted
export interface BangInfoExport {
	keyword: string;
	alias: string | null;
	defaultUrl: string;
	urls: Array<string>;
	dontEncodeQuery: boolean;
}

// The same as Config with all the "id" fields omitted
export type BangsExport = {
	version: number;
	bangs: BangInfoExport[];
};

export function withDefaultOptions(
	options: Partial<Options> | null | undefined,
): Options {
	const optionsWithPossibleDefaults = options ?? {};

	return {
		...defaultOptions,
		...optionsWithPossibleDefaults,
		trigger:
			typeof optionsWithPossibleDefaults.trigger === "string"
				? optionsWithPossibleDefaults.trigger
				: defaultOptions.trigger,
		storageMethod: allowedStorageMethodsAsArray.includes(
			optionsWithPossibleDefaults.storageMethod as allowedStorageMethodsAsType,
		)
			? (optionsWithPossibleDefaults.storageMethod as allowedStorageMethodsAsType)
			: defaultOptions.storageMethod,
		ignoredSearchDomains: Array.isArray(
			optionsWithPossibleDefaults.ignoredSearchDomains,
		)
			? [...optionsWithPossibleDefaults.ignoredSearchDomains]
			: [...defaultOptions.ignoredSearchDomains],
		ignoreBangCase:
			typeof optionsWithPossibleDefaults.ignoreBangCase === "boolean"
				? optionsWithPossibleDefaults.ignoreBangCase
				: defaultOptions.ignoreBangCase,
		ignoreBangKeyboardLayout:
			typeof optionsWithPossibleDefaults.ignoreBangKeyboardLayout === "boolean"
				? optionsWithPossibleDefaults.ignoreBangKeyboardLayout
				: defaultOptions.ignoreBangKeyboardLayout,
	};
}

export function withConfigDefaults(cfg: Config): Config {
	return {
		...cfg,
		options: withDefaultOptions(cfg.options),
	};
}

export function bangInfosFromExport(bangs: BangInfoExport[]): BangInfo[] {
	return bangs.map((bang) => ({
		id: crypto.randomUUID(),
		keyword: bang.keyword,
		alias: bang.alias,
		defaultUrl: bang.defaultUrl,
		urls: bang.urls.map((url) => ({
			id: crypto.randomUUID(),
			url,
		})),
		dontEncodeQuery: bang.dontEncodeQuery,
	}));
}

export function bangInfosToExport(bangs: BangInfo[]): BangInfoExport[] {
	return bangs.map((bang) => ({
		keyword: bang.keyword,
		alias: bang.alias,
		defaultUrl: bang.defaultUrl,
		urls: bang.urls.map((urlInfo) => urlInfo.url),
		dontEncodeQuery: bang.dontEncodeQuery,
	}));
}
