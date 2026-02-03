<script lang="ts">
	type Sentiment = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'AMBIVALENT';

	interface Props {
		name: string;
		sentiment?: Sentiment | null;
		size?: 'sm' | 'md' | 'lg';
		clickable?: boolean;
		frequency?: number;
		onclick?: () => void;
	}

	let {
		name,
		sentiment = null,
		size = 'md',
		clickable = false,
		frequency,
		onclick
	}: Props = $props();

	const sizeClasses = {
		sm: 'text-xs px-2 py-1',
		md: 'text-sm px-3 py-1.5',
		lg: 'text-base px-4 py-2'
	};

	const sentimentColors: Record<Sentiment, string> = {
		POSITIVE: 'badge-success',
		NEGATIVE: 'badge-error',
		NEUTRAL: 'badge-ghost',
		AMBIVALENT: 'badge-warning'
	};

	const sentimentColor = sentiment ? sentimentColors[sentiment] : 'badge-ghost';
	const sizeClass = sizeClasses[size];
	const cursorClass = clickable ? 'cursor-pointer hover:scale-105' : '';
	const transitionClass = 'transition-all duration-200';

	// Calculate font size based on frequency for tag cloud
	const getFontSize = () => {
		if (!frequency) return '';
		if (frequency >= 10) return 'text-2xl';
		if (frequency >= 7) return 'text-xl';
		if (frequency >= 5) return 'text-lg';
		if (frequency >= 3) return 'text-base';
		return 'text-sm';
	};

	const fontSizeClass = frequency ? getFontSize() : '';
</script>

<button
	class="badge {sentimentColor} {sizeClass} {cursorClass} {transitionClass} {fontSizeClass}"
	{onclick}
	disabled={!clickable}
	type="button"
>
	{name}
</button>
