export interface ICategoryDiscoveryAdapter {
    readonly siteId: string;
    readonly baseUrl: string;
    discoverCategories(): Promise<CategoryMetadata[]>;
    buildCategoryTree(): Promise<CategoryNode[]>;
}
export interface CategoryMetadata {
    slug: string;
    name: string;
    url: string;
    parentId: string | null;
}
export interface CategoryNode extends CategoryMetadata {
    children: CategoryNode[];
}
