export const MAX_RESOURCE_URL_LENGTH = 2048;
export const RESOURCE_URL_VALIDATION_MESSAGE =
    "教材・アプリリンクには、http:// または https:// で始まる正しいURLを入力してください。";
export const RESOURCE_URL_LENGTH_MESSAGE =
    "教材・アプリリンクが長すぎます。2048文字以内の閲覧用URLを入力してください。";


export function normalizeResourceUrl(value) {

    const resourceUrl = String(value || "").trim();

    if (!resourceUrl) {
        return "";
    }

    if (resourceUrl.length > MAX_RESOURCE_URL_LENGTH) {
        throw new Error("resource-url-too-long");
    }

    let parsedUrl;

    try {
        parsedUrl = new URL(resourceUrl);
    } catch (error) {
        throw new Error("invalid-resource-url");
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
        throw new Error("invalid-resource-url-protocol");
    }

    const normalizedUrl = parsedUrl.href;

    if (normalizedUrl.length > MAX_RESOURCE_URL_LENGTH) {
        throw new Error("resource-url-too-long");
    }

    return normalizedUrl;

}


export function getSafeResourceUrl(value) {

    try {
        return normalizeResourceUrl(value);
    } catch (error) {
        return "";
    }

}


export function configureResourceUrlInput(input) {

    if (!input) {
        return;
    }

    input.addEventListener("input", () => {
        input.setCustomValidity("");
    });

    input.addEventListener("invalid", () => {
        if (input.value.trim()) {
            input.setCustomValidity(
                input.validity.tooLong
                    ? RESOURCE_URL_LENGTH_MESSAGE
                    : RESOURCE_URL_VALIDATION_MESSAGE
            );
        }
    });

}
