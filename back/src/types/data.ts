export type AssetFile = {
	assets: Asset[];
};

export type Asset = {
	id: number;
	name: string;
	url: string;
	downloadedPath?: string;
};

export type ApiKeys = {
	elevenLabsApiKey: string;
};
