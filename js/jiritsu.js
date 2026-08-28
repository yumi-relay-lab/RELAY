export const JIRITSU_CATEGORIES = [
    "健康の保持",
    "心理的な安定",
    "人間関係の形成",
    "環境の把握",
    "身体の動き",
    "コミュニケーション"
];

const JIRITSU_CATEGORY_SET = new Set(JIRITSU_CATEGORIES);

export function sanitizeJiritsuCategories(value) {
    if (!Array.isArray(value)) return [];

    return [...new Set(value
        .map(category => String(category).trim())
        .filter(category => JIRITSU_CATEGORY_SET.has(category)))];
}

export function renderJiritsuOptions(containerId, name = "jiritsuCategories") {
    const container = document.getElementById(containerId);

    if (!container) return;

    JIRITSU_CATEGORIES.forEach((category, index) => {
        const label = document.createElement("label");
        const checkbox = document.createElement("input");
        const text = document.createElement("span");

        label.className = "tag-option jiritsu-option";
        checkbox.type = "checkbox";
        checkbox.name = name;
        checkbox.value = category;
        checkbox.id = `${containerId}-${index}`;
        text.textContent = category;
        label.append(checkbox, text);
        container.appendChild(label);
    });
}

export function getSelectedJiritsuCategories(containerId) {
    return sanitizeJiritsuCategories(Array.from(
        document.querySelectorAll(`#${containerId} input[name="jiritsuCategories"]:checked`),
        checkbox => checkbox.value
    ));
}
