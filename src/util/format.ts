export const stripNulls = (str: string): string => {
    return str.replace('\0', '');
}

export const fileToContentPrefix = (file: File) => {
    return new TextEncoder().encode(`${stripNulls(file.name)}\0${stripNulls(file.type)}\0`);
}