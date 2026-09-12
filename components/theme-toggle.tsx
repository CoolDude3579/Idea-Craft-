import { setThemeAction } from "@/app/theme-actions";
import type { Theme } from "@/lib/theme";

const OPTIONS: ReadonlyArray<{ value: Theme; label: string; title: string }> = [
  { value: "auto", label: "Auto", title: "Follow the system setting" },
  { value: "light", label: "Light", title: "Cream paper" },
  { value: "dark", label: "Dark", title: "Dark" },
];

/**
 * Three real submit buttons in a form, not a client component: the choice is a
 * cookie the server already reads, so there is nothing for JavaScript to do
 * here. It also means the control works before hydration and with scripting
 * off, which a themed toggle usually does not.
 */
export function ThemeToggle({ current }: { current: Theme }) {
  return (
    <form className="themetoggle" action={setThemeAction}>
      <fieldset>
        <legend className="visuallyhidden">Palette</legend>
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="submit"
            name="theme"
            value={option.value}
            title={option.title}
            aria-pressed={current === option.value}
          >
            {option.label}
          </button>
        ))}
      </fieldset>
    </form>
  );
}

export default ThemeToggle;
