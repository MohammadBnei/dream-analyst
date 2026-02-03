import type { ChartOptions, ScriptableContext } from 'chart.js/auto';

// Theme-aware color palettes
export const getChartColors = (theme: 'light' | 'dark' = 'dark') => {
	if (theme === 'dark') {
		return {
			primary: '#6366f1',
			secondary: '#c4a777',
			success: '#10b981',
			warning: '#fb923c',
			error: '#ef4444',
			info: '#3b82f6',
			text: '#ffffff',
			textSecondary: '#a0a0a0',
			grid: 'rgba(255, 255, 255, 0.1)',
			background: '#2a2d3a'
		};
	}
	return {
		primary: '#4f46e5',
		secondary: '#c4a777',
		success: '#059669',
		warning: '#ea580c',
		error: '#dc2626',
		info: '#2563eb',
		text: '#1f2937',
		textSecondary: '#6b7280',
		grid: 'rgba(0, 0, 0, 0.1)',
		background: '#ffffff'
	};
};

// Gradient generators for sentiment charts
export const createSentimentGradient = (
	ctx: CanvasRenderingContext2D,
	chartArea: { top: number; bottom: number }
) => {
	const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
	gradient.addColorStop(0, 'rgba(239, 68, 68, 0.5)'); // Red at bottom (negative)
	gradient.addColorStop(0.5, 'rgba(251, 146, 60, 0.3)'); // Orange at middle
	gradient.addColorStop(1, 'rgba(16, 185, 129, 0.5)'); // Green at top (positive)
	return gradient;
};

// Default chart options
export const getDefaultLineChartOptions = (
	theme: 'light' | 'dark' = 'dark'
): ChartOptions<'line'> => {
	const colors = getChartColors(theme);

	return {
		responsive: true,
		maintainAspectRatio: false,
		interaction: {
			mode: 'index',
			intersect: false
		},
		plugins: {
			legend: {
				display: true,
				labels: {
					color: colors.text,
					font: {
						size: 12
					}
				}
			},
			tooltip: {
				backgroundColor: colors.background,
				titleColor: colors.text,
				bodyColor: colors.textSecondary,
				borderColor: colors.grid,
				borderWidth: 1,
				padding: 12,
				displayColors: true
			}
		},
		scales: {
			x: {
				grid: {
					color: colors.grid
				},
				ticks: {
					color: colors.textSecondary,
					font: {
						size: 11
					}
				}
			},
			y: {
				grid: {
					color: colors.grid
				},
				ticks: {
					color: colors.textSecondary,
					font: {
						size: 11
					}
				}
			}
		}
	};
};

// Format data for mood vs lucidity chart
export interface MoodLucidityData {
	date: string;
	mood: number;
	lucidity: number;
}

export const formatMoodLucidityChartData = (
	data: MoodLucidityData[],
	theme: 'light' | 'dark' = 'dark'
) => {
	const colors = getChartColors(theme);

	return {
		labels: data.map((d) => d.date),
		datasets: [
			{
				label: 'Mood',
				data: data.map((d) => d.mood),
				borderColor: colors.primary,
				backgroundColor: `${colors.primary}33`,
				tension: 0.4,
				fill: false
			},
			{
				label: 'Lucidity',
				data: data.map((d) => d.lucidity),
				borderColor: colors.secondary,
				backgroundColor: `${colors.secondary}33`,
				tension: 0.4,
				fill: false
			}
		]
	};
};

// Format data for symbol sentiment progression
export interface SentimentProgressionData {
	date: string;
	sentiment: number;
	dreamTitle?: string;
	dreamId?: string;
}

export const formatSentimentProgressionChartData = (
	data: SentimentProgressionData[],
	symbolName: string,
	theme: 'light' | 'dark' = 'dark'
) => {
	const colors = getChartColors(theme);

	return {
		labels: data.map((d) => d.date),
		datasets: [
			{
				label: `${symbolName} Sentiment`,
				data: data.map((d) => d.sentiment),
				borderColor: colors.primary,
				backgroundColor: (context: ScriptableContext<'line'>) => {
					const chart = context.chart;
					const { ctx, chartArea } = chart;
					if (!chartArea) return colors.primary;
					return createSentimentGradient(ctx, chartArea);
				},
				tension: 0.4,
				fill: true,
				pointRadius: 5,
				pointHoverRadius: 7
			}
		]
	};
};

// Detect current theme from document
export const getCurrentTheme = (): 'light' | 'dark' => {
	if (typeof document !== 'undefined') {
		const theme = document.documentElement.getAttribute('data-theme');
		return theme === 'light' ? 'light' : 'dark';
	}
	return 'dark';
};
