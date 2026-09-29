import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
  type Plugin,
} from 'chart.js';

Chart.register(LineController, BarController, LineElement, PointElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);
Chart.defaults.font.family = '"Heebo Variable", Heebo, system-ui, sans-serif';

const rtl = {
  legend: { rtl: true, textDirection: 'rtl' },
  tooltip: { rtl: true, textDirection: 'rtl' },
} as const;

function token(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function themeDefaults(): void {
  // Canvas text does not inherit CSS; take the theme's colors so charts stay readable in dark mode.
  Chart.defaults.color = token('--fg-muted', '#475569');
  Chart.defaults.borderColor = token('--border', '#E2E8F0');
}

export async function fontsReady(): Promise<void> {
  if (!('fonts' in document)) return;
  // Sample text with Hebrew and digits, so the Hebrew and Latin subsets both load before drawing.
  await Promise.all(['400', '500'].map((w) => document.fonts.load(`${w} 12px "Heebo Variable"`, 'אב 0123')));
}

function missingDaysOutline(missing: readonly number[], color: string): Plugin<'bar'> {
  return {
    id: 'missingDaysOutline',
    afterDatasetsDraw(chart) {
      const { ctx, chartArea, scales } = chart;
      const x = scales['x'];
      if (!x) return;
      const half = (x.width / Math.max(chart.data.labels?.length ?? 1, 1)) * 0.4;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      for (const i of missing) {
        const cx = x.getPixelForValue(i);
        ctx.strokeRect(cx - half, chartArea.top, half * 2, chartArea.bottom - chartArea.top);
      }
      ctx.restore();
    },
  };
}

export function weekChart(
  canvas: HTMLCanvasElement,
  labels: string[],
  kcalIn: (number | null)[],
  kcalOut: (number | null)[],
  missing: readonly number[],
): Chart<'bar'> {
  themeDefaults();
  const config: ChartConfiguration<'bar', (number | null)[], string> = {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'נכנס', data: kcalIn, backgroundColor: token('--in', '#EA580C'), borderRadius: 4 },
        { label: 'יצא', data: kcalOut, backgroundColor: token('--out', '#1D9E75'), borderRadius: 4 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: { x: { type: 'category', reverse: false }, y: { type: 'linear', beginAtZero: true } },
      plugins: rtl,
    },
    plugins: [missingDaysOutline(missing, token('--danger', '#DC2626'))],
  };
  return new Chart(canvas, config);
}
