export function VolumeUp() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="h-full w-auto overflow-visible!"
    >
      <title>volume-up</title>
      <g fill="currentColor">
        <path
          d="m8,7h-3c-1.1046,0-2,.8954-2,2v2c0,1.1046.8954,2,2,2h3l4.5227,3.7689c.5866.4889,1.4773.0717,1.4773-.6919V3.923c0-.7636-.8906-1.1808-1.4773-.6919l-4.5227,3.7689Z"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
        <path
          className="vol-line"
          d="m17.4142,8.5858c.781.781.781,2.0474,0,2.8284"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
        />
      </g>
    </svg>
  );
}
