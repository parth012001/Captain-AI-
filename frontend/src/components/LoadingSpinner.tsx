// React import not needed for modern JSX transform

export default function LoadingSpinner() {
  return (
    <div className="loading-container">
      <div className="loading-spinner large"></div>
      <p>Loading...</p>
    </div>
  );
}