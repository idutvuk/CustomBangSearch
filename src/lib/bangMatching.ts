import type * as config from "./config/config";

type BangMatchingOptions = Pick<
	config.Options,
	"ignoreBangCase" | "ignoreBangKeyboardLayout"
>;

type CodeToSymbolMap = Readonly<Record<string, string>>;

export interface ReverseKeyboardLayoutMap {
	readonly mappings: ReadonlyMap<string, string>;
	readonly maxSequenceLength: number;
}

interface KeyboardLayoutMapLike {
	entries(): IterableIterator<[string, string]>;
}

interface NavigatorWithKeyboard extends Navigator {
	keyboard?: {
		getLayoutMap?: () => Promise<KeyboardLayoutMapLike>;
	};
}

const latinQwertyByCode: CodeToSymbolMap = {
	TLDE: "`",
	AE01: "1",
	AE02: "2",
	AE03: "3",
	AE04: "4",
	AE05: "5",
	AE06: "6",
	AE07: "7",
	AE08: "8",
	AE09: "9",
	AE10: "0",
	AE11: "-",
	AE12: "=",
	AD01: "q",
	AD02: "w",
	AD03: "e",
	AD04: "r",
	AD05: "t",
	AD06: "y",
	AD07: "u",
	AD08: "i",
	AD09: "o",
	AD10: "p",
	AD11: "[",
	AD12: "]",
	AC01: "a",
	AC02: "s",
	AC03: "d",
	AC04: "f",
	AC05: "g",
	AC06: "h",
	AC07: "j",
	AC08: "k",
	AC09: "l",
	AC10: ";",
	AC11: "'",
	BKSL: "\\",
	AB01: "z",
	AB02: "x",
	AB03: "c",
	AB04: "v",
	AB05: "b",
	AB06: "n",
	AB07: "m",
	AB08: ",",
	AB09: ".",
	AB10: "/",
};

const staticLayoutMapsByCode: ReadonlyArray<CodeToSymbolMap> = [
	{
		TLDE: "ё",
		AD01: "й",
		AD02: "ц",
		AD03: "у",
		AD04: "к",
		AD05: "е",
		AD06: "н",
		AD07: "г",
		AD08: "ш",
		AD09: "щ",
		AD10: "з",
		AD11: "х",
		AD12: "ъ",
		AC01: "ф",
		AC02: "ы",
		AC03: "в",
		AC04: "а",
		AC05: "п",
		AC06: "р",
		AC07: "о",
		AC08: "л",
		AC09: "д",
		AC10: "ж",
		AC11: "э",
		AB01: "я",
		AB02: "ч",
		AB03: "с",
		AB04: "м",
		AB05: "и",
		AB06: "т",
		AB07: "ь",
		AB08: "б",
		AB09: "ю",
		AB10: ".",
	},
	{
		TLDE: "'",
		AD01: "й",
		AD02: "ц",
		AD03: "у",
		AD04: "к",
		AD05: "е",
		AD06: "н",
		AD07: "г",
		AD08: "ш",
		AD09: "щ",
		AD10: "з",
		AD11: "х",
		AD12: "ї",
		BKSL: "ґ",
		AC01: "ф",
		AC02: "і",
		AC03: "в",
		AC04: "а",
		AC05: "п",
		AC06: "р",
		AC07: "о",
		AC08: "л",
		AC09: "д",
		AC10: "ж",
		AC11: "є",
		AB01: "я",
		AB02: "ч",
		AB03: "с",
		AB04: "м",
		AB05: "и",
		AB06: "т",
		AB07: "ь",
		AB08: "б",
		AB09: "ю",
		AB10: ".",
	},
	{
		TLDE: "ذ",
		AD01: "ض",
		AD02: "ص",
		AD03: "ث",
		AD04: "ق",
		AD05: "ف",
		AD06: "غ",
		AD07: "ع",
		AD08: "ه",
		AD09: "خ",
		AD10: "ح",
		AD11: "ج",
		AD12: "د",
		AC01: "ش",
		AC02: "س",
		AC03: "ي",
		AC04: "ب",
		AC05: "ل",
		AC06: "ا",
		AC07: "ت",
		AC08: "ن",
		AC09: "م",
		AC10: "ك",
		AC11: "ط",
		AB01: "ئ",
		AB02: "ء",
		AB03: "ؤ",
		AB04: "ر",
		AB05: "ﻻ",
		AB06: "ى",
		AB07: "ة",
		AB08: "و",
		AB09: "ز",
		AB10: "ظ",
	},
];

function addReverseMapping(
	mappings: Map<string, string>,
	produced: string,
	latin: string,
): void {
	const normalized = produced.normalize("NFC");
	if (!mappings.has(normalized)) {
		mappings.set(normalized, latin);
	}

	const lowerProduced = normalized.toLowerCase();
	if (!mappings.has(lowerProduced)) {
		mappings.set(lowerProduced, latin.toLowerCase());
	}

	const upperProduced = normalized.toUpperCase();
	if (!mappings.has(upperProduced)) {
		mappings.set(upperProduced, latin.toUpperCase());
	}
}

function createReverseKeyboardLayoutMap(
	layoutByCode: CodeToSymbolMap,
	extraEntries: Array<[string, string]> = [],
): ReverseKeyboardLayoutMap {
	const mappings = new Map<string, string>();

	for (const [code, produced] of Object.entries(layoutByCode)) {
		const latin = latinQwertyByCode[code];
		if (latin !== undefined) {
			addReverseMapping(mappings, produced, latin);
		}
	}

	for (const [produced, latin] of extraEntries) {
		addReverseMapping(mappings, produced, latin);
	}

	return {
		mappings,
		maxSequenceLength: Math.max(
			1,
			...Array.from(mappings.keys(), (key) => key.length),
		),
	};
}

const staticReverseKeyboardLayoutMaps: ReadonlyArray<ReverseKeyboardLayoutMap> = [
	createReverseKeyboardLayoutMap(staticLayoutMapsByCode[0]),
	createReverseKeyboardLayoutMap(staticLayoutMapsByCode[1]),
	createReverseKeyboardLayoutMap(staticLayoutMapsByCode[2], [["لا", "b"]]),
];

function addComparableKeyword(
	keywords: Set<string>,
	keyword: string,
	ignoreCase: boolean,
): void {
	const normalized = keyword.normalize("NFC");
	keywords.add(normalized);

	if (ignoreCase) {
		keywords.add(normalized.toLowerCase());
	}
}

function translateKeywordWithReverseMap(
	keyword: string,
	reverseMap: ReverseKeyboardLayoutMap,
): string {
	const normalizedKeyword = keyword.normalize("NFC");
	let translated = "";

	for (let index = 0; index < normalizedKeyword.length; ) {
		let matched = false;
		const maxLength = Math.min(
			reverseMap.maxSequenceLength,
			normalizedKeyword.length - index,
		);

		for (let sequenceLength = maxLength; sequenceLength >= 1; sequenceLength -= 1) {
			const sequence = normalizedKeyword.slice(index, index + sequenceLength);
			const mapped = reverseMap.mappings.get(sequence);
			if (mapped !== undefined) {
				translated += mapped;
				index += sequenceLength;
				matched = true;
				break;
			}
		}

		if (!matched) {
			translated += normalizedKeyword[index];
			index += 1;
		}
	}

	return translated;
}

export function getStaticKeyboardLayoutReverseMaps(): ReadonlyArray<ReverseKeyboardLayoutMap> {
	return staticReverseKeyboardLayoutMaps;
}

export async function getActiveKeyboardLayoutReverseMap(): Promise<ReverseKeyboardLayoutMap | null> {
	const keyboard = (globalThis.navigator as NavigatorWithKeyboard | undefined)
		?.keyboard;

	if (keyboard?.getLayoutMap === undefined) {
		return null;
	}

	try {
		const layoutMap = await keyboard.getLayoutMap();
		const currentLayoutByCode = Object.fromEntries(layoutMap.entries());
		return createReverseKeyboardLayoutMap(currentLayoutByCode);
	} catch {
		return null;
	}
}

export async function getKeyboardLayoutReverseMaps(): Promise<
	ReadonlyArray<ReverseKeyboardLayoutMap>
> {
	const activeLayout = await getActiveKeyboardLayoutReverseMap();
	if (activeLayout === null) {
		return staticReverseKeyboardLayoutMaps;
	}

	return [...staticReverseKeyboardLayoutMaps, activeLayout];
}

export function getBangComparableKeywords(
	keyword: string,
	options: BangMatchingOptions,
	reverseMaps: ReadonlyArray<ReverseKeyboardLayoutMap> = [],
): ReadonlySet<string> {
	const comparableKeywords = new Set<string>();

	addComparableKeyword(comparableKeywords, keyword, options.ignoreBangCase);

	if (!options.ignoreBangKeyboardLayout) {
		return comparableKeywords;
	}

	for (const reverseMap of reverseMaps) {
		addComparableKeyword(
			comparableKeywords,
			translateKeywordWithReverseMap(keyword, reverseMap),
			options.ignoreBangCase,
		);
	}

	return comparableKeywords;
}

export function keywordsOverlap(
	left: ReadonlySet<string>,
	right: ReadonlySet<string>,
): boolean {
	for (const keyword of left) {
		if (right.has(keyword)) {
			return true;
		}
	}

	return false;
}
