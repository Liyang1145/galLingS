/** An optional presentation-only label slot keeps existing icons when shared controls change text. */
export function setButtonLabel(button: HTMLButtonElement, text: string): void {
  const label = button.querySelector<HTMLElement>(":scope > [data-player-label]") ?? button;
  if (label.textContent !== text) label.textContent = text;
}
