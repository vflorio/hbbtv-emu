export default function App({ videoElement }: { videoElement: HTMLVideoElement }) {
  return <div>src= {videoElement.src}</div>;
}
