/**
 * Opens a web search for a component's datasheet.
 * @param mpn - The Manufacturer Part Number of the component.
 */
export const openDatasheet = async (mpn: string): Promise<void> => {
    const query = encodeURIComponent(`${mpn} datasheet pdf`);
    // Using a privacy-focused search engine for the fallback
    window.open(`https://duckduckgo.com/?q=${query}`, '_blank', 'noopener,noreferrer');
};
