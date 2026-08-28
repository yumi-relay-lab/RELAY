const copyButton = document.getElementById("copyAiPrompt");
const promptText = document.getElementById("aiDraftPrompt");
const copyStatus = document.getElementById("copyAiPromptStatus");

copyButton?.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(promptText.value);
        copyStatus.textContent = "プロンプトをコピーしました。AIの画面へ貼り付けてください。";
    } catch (error) {
        promptText.focus();
        promptText.select();
        copyStatus.textContent = "自動でコピーできませんでした。選択された文章を手動でコピーしてください。";
    }
});
