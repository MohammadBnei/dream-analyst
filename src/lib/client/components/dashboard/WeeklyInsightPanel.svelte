<script lang="ts">
	import {
		Chart as ChartJS,
		Title,
		Tooltip,
		Legend,
		LineElement,
		CategoryScale,
		LinearScale,
		PointElement,
		Filler
	} from 'chart.js/auto';
	import ChartContainer from '../shared/ChartContainer.svelte';
	import {
		formatMoodLucidityChartData,
		getDefaultLineChartOptions,
		getCurrentTheme,
		type MoodLucidityData
	} from '$lib/client/services/chartService';
	import { goto } from '$app/navigation';
	import { onDestroy } from 'svelte';

	ChartJS.register(
		Title,
		Tooltip,
		Legend,
		LineElement,
		CategoryScale,
		LinearScale,
		PointElement,
		Filler
	);

	interface Props {
		insightData?: {
			moodTrends?: MoodLucidityData[];
			title?: string;
		} | null;
	}

	let { insightData }: Props = $props();

	const chartData = $derived.by(() => {
		if (!insightData?.moodTrends) {
			// Default placeholder data
			return formatMoodLucidityChartData(
				[
					{ date: '1 Days', mood: 45, lucidity: 30 },
					{ date: '2 Days', mood: 52, lucidity: 35 },
					{ date: '3 Days', mood: 48, lucidity: 55 },
					{ date: '4 Days', mood: 68, lucidity: 45 },
					{ date: '5 Days', mood: 72, lucidity: 60 },
					{ date: '6 Days', mood: 85, lucidity: 75 },
					{ date: '7 Days', mood: 92, lucidity: 85 }
				],
				getCurrentTheme()
			);
		}
		return formatMoodLucidityChartData(insightData.moodTrends, getCurrentTheme());
	});

	const chartOptions = getDefaultLineChartOptions(getCurrentTheme());

	let canvas;
	let chartInstance = null;

	$effect(() => {
		if (canvas && chartData) {
			if (chartInstance) chartInstance.destroy();
			chartInstance = new ChartJS(canvas, {
				type: 'line',
				data: chartData,
				options: chartOptions
			});
		}
	});

	onDestroy(() => {
		if (chartInstance) chartInstance.destroy();
	});
</script>

<div class="card bg-base-200 shadow-lg">
	<div class="card-body">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h2 class="card-title text-xl">Weekly Insight Report</h2>
				<p class="mt-1 text-sm text-base-content/70">
					Mood and Lucidity trends from your recent dreams
				</p>
			</div>
			<button
				type="button"
				class="btn bg-[#c4a777] text-white btn-sm hover:bg-[#b89760]"
				onclick={() => goto('/trends')}
			>
				Deep Dive Analysis
			</button>
		</div>

		<ChartContainer title="Mood vs. Lucidity Trends">
			<div class="h-64">
				<canvas bind:this={canvas}></canvas>
			</div>
		</ChartContainer>
	</div>
</div>
