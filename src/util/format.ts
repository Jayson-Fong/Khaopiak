/**
 * Remove all null characters from a string
 * @param str A string
 */
export const stripNulls = (str: string): string => {
    return str.replace('\0', '');
}

/**
 * Returns a Uint8Array of a string containing the file and content type of the file, each suffixed by a null byte
 * @param file A File object
 */
export const fileToContentPrefix = (file: File): Uint8Array => {
    return new TextEncoder().encode(`${stripNulls(file.name)}\0${stripNulls(file.type)}\0`);
}

/**
 * Extracts the file name and type as encoded by filesToContentPrefix() and returns the content start index
 * @param buffer A buffer such that a file name and content type can be found prefixed, each suffixed with a null byte
 * @see fileToContentPrefix
 * TODO: Integrate file expiries!
 */
export const extractContentPrefix = (buffer: Uint8Array) => {
    let separatorIndices: number[] = [];

    for (let byteIndex = 0; byteIndex < buffer.byteLength && separatorIndices.length < 2; byteIndex++) {
        if (buffer[byteIndex] == 0) {
            separatorIndices.push(byteIndex);
        }
    }

    if (separatorIndices.length < 2) {
        throw Error('Failed to locate file name/type separators');
    }

    const decoder = new TextDecoder();

    return {
        name: decoder.decode(buffer.slice(0, separatorIndices[0])),
        type: decoder.decode(buffer.slice(separatorIndices[0] + 1, separatorIndices[1])),
        contentStart: separatorIndices[1] + 1
    };
}

/**
 * Checks the start of the view for the application/pdf magic
 * @param view A view, optimally one of exactly 5 bytes
 */
export const isPDF = (view: Uint8Array): boolean => {
    return view[0] == 0x25
        && view[1] == 0x50
        && view[2] == 0x44
        && view[3] == 0x46
        && view[4] == 0x2D;
}