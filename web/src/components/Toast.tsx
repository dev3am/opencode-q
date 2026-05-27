interface Props {
	message: string;
	onClose: () => void;
}

export default function Toast({ message, onClose }: Props) {
	return (
		<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-3">
			<span>{message}</span>
			<button onClick={onClose} className="text-white/80 hover:text-white">
				✕
			</button>
		</div>
	);
}
