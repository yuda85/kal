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

export async function fontsReady(): Promise<void> {
  if (!('fonts' in document)) return;
  await Promise.all(['400', '500'].map((w) => document.fonts.load(`${w} 12px "Heebo Variable"`)));
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

export function weightChart(
  canvas: HTMLCanvasElement,
  labels: string[],
  trend: (number | null)[],
  plan: (number | null)[],
  target: (number | null)[],
  weighIns: (number | null)[],
): Chart<'line'> {
  const muted = token('--neutral-bar', '#888780');
  const config: ChartConfiguration<'line', (number | null)[], string> = {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'מגמה', data: trend, borderColor: token('--out', '#1D9E75'), borderWidth: 2.5, pointRadius: 0, tension: 0.3, spanGaps: true },
        { label: 'תוכנית', data: plan, borderColor: token('--primary', '#0F6E56'), borderWidth: 2, borderDash: [6, 4], pointRadius: 0 },
        { label: 'יעד', data: target, borderColor: muted, borderWidth: 2, borderDash: [2, 3], pointRadius: 0 },
        { label: 'שקילות', data: weighIns, showLine: false, pointRadius: 3, pointBackgroundColor: muted, borderColor: muted },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'index', intersect: false },
      scales: { x: { type: 'category', reverse: false }, y: { type: 'linear', grace: '5%' } },
      plugins: rtl,
    },
  };
  return new Chart(canvas, config);
}
