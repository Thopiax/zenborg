/** biome-ignore-all lint/a11y/noSvgWithoutTitle: <explanation> */
"use client";

import { useCallback, useRef, useState } from "react";
import type { PhaseConfig } from "@/domain/value-objects/Phase";
import { Phase } from "@/domain/value-objects/Phase";
import { PHASE_STYLES } from "@/domain/value-objects/phaseStyles";

interface CircularPhaseSliderProps {
  phaseConfigs: PhaseConfig[];
  onUpdatePhase: (phaseId: string, updates: Partial<PhaseConfig>) => void;
}

/**
 * CircularPhaseSlider - Custom SVG-based 24-hour circular slider
 *
 * Features:
 * - 4 draggable pointers for phase boundaries
 * - Colored arc segments between pointers
 * - NOW indicator showing current time
 * - Hour markers at quarter points
 */
export function CircularPhaseSlider({
  phaseConfigs,
  onUpdatePhase,
}: CircularPhaseSliderProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingPointer, setDraggingPointer] = useState<number | null>(null);

  // Constants
  const SIZE = 400;
  const CENTER = SIZE / 2;
  const OUTER_RADIUS = 160;
  const INNER_RADIUS = 115; // Slightly thinner donut (45px vs 50px)

  // Find specific phases
  const morningPhase = phaseConfigs.find((p) => p.phase === "MORNING");
  const afternoonPhase = phaseConfigs.find((p) => p.phase === "AFTERNOON");
  const eveningPhase = phaseConfigs.find((p) => p.phase === "EVENING");
  const nightPhase = phaseConfigs.find((p) => p.phase === "NIGHT");

  // Get pointer positions (in hours)
  const pointerHours = [
    nightPhase?.startHour ?? 22, // Bedtime (start of Night)
    morningPhase?.startHour ?? 6, // Wake-up (start of Morning)
    afternoonPhase?.startHour ?? 12, // Start of Afternoon
    eveningPhase?.startHour ?? 18, // Start of Evening
  ];

  // Get phase colors from PHASE_STYLES
  const phaseColors = [
    PHASE_STYLES[Phase.NIGHT].background,
    PHASE_STYLES[Phase.MORNING].background,
    PHASE_STYLES[Phase.AFTERNOON].background,
    PHASE_STYLES[Phase.EVENING].background,
  ];

  // Convert hour (0-23) to angle in degrees (0° = top/12AM)
  const hourToAngle = (hour: number): number => {
    return (hour / 24) * 360 - 90; // -90 to start at top
  };

  // Convert angle to hour
  const angleToHour = (angle: number): number => {
    const normalized = (angle + 90 + 360) % 360;
    return Math.round((normalized / 360) * 24) % 24;
  };

  // Get SVG coordinates for a point on the circle
  const polarToCartesian = (
    angle: number,
    radius: number
  ): { x: number; y: number } => {
    const radians = (angle * Math.PI) / 180;
    return {
      x: CENTER + radius * Math.cos(radians),
      y: CENTER + radius * Math.sin(radians),
    };
  };

  // Create SVG donut arc path (filled segment between inner and outer radius)
  const describeDonutArc = (
    startAngle: number,
    endAngle: number,
    outerRadius: number,
    innerRadius: number
  ): string => {
    const start = startAngle;
    let end = endAngle;

    // Handle wrap-around
    if (end < start) {
      end += 360;
    }

    const outerStart = polarToCartesian(start, outerRadius);
    const outerEnd = polarToCartesian(end, outerRadius);
    const innerStart = polarToCartesian(start, innerRadius);
    const innerEnd = polarToCartesian(end, innerRadius);

    const largeArcFlag = end - start <= 180 ? "0" : "1";

    return [
      "M",
      outerStart.x,
      outerStart.y,
      "A",
      outerRadius,
      outerRadius,
      0,
      largeArcFlag,
      1,
      outerEnd.x,
      outerEnd.y,
      "L",
      innerEnd.x,
      innerEnd.y,
      "A",
      innerRadius,
      innerRadius,
      0,
      largeArcFlag,
      0,
      innerStart.x,
      innerStart.y,
      "Z",
    ].join(" ");
  };

  // Handle pointer drag
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const handlePointerMove = useCallback(
    (event: MouseEvent | TouchEvent) => {
      if (draggingPointer === null || !svgRef.current) return;

      const svg = svgRef.current;
      const rect = svg.getBoundingClientRect();

      const clientX =
        "touches" in event ? event.touches[0].clientX : event.clientX;
      const clientY =
        "touches" in event ? event.touches[0].clientY : event.clientY;

      const x = clientX - rect.left - CENTER;
      const y = clientY - rect.top - CENTER;

      const angle = (Math.atan2(y, x) * 180) / Math.PI;
      const hour = angleToHour(angle);

      // Update the appropriate phase based on which pointer is being dragged
      const phaseMap = [nightPhase, morningPhase, afternoonPhase, eveningPhase];
      const phase = phaseMap[draggingPointer];

      if (!phase) return;

      // Update phase start hour
      onUpdatePhase(phase.id, { startHour: hour });

      // Update adjacent phase end hours
      if (draggingPointer === 0 && eveningPhase) {
        // Night pointer updates Evening's end
        onUpdatePhase(eveningPhase.id, { endHour: hour });
      } else if (draggingPointer === 1 && nightPhase) {
        // Morning pointer updates Night's end
        onUpdatePhase(nightPhase.id, { endHour: hour });
      } else if (draggingPointer === 2 && morningPhase) {
        // Afternoon pointer updates Morning's end
        onUpdatePhase(morningPhase.id, { endHour: hour });
      } else if (draggingPointer === 3 && afternoonPhase) {
        // Evening pointer updates Afternoon's end
        onUpdatePhase(afternoonPhase.id, { endHour: hour });
      }
    },
    [
      CENTER,
      draggingPointer,
      nightPhase,
      morningPhase,
      afternoonPhase,
      eveningPhase,
      onUpdatePhase,
    ]
  );

  const handlePointerUp = useCallback(() => {
    setDraggingPointer(null);
  }, []);

  // Attach/detach event listeners
  const handlePointerDown = (index: number) => {
    setDraggingPointer(index);
  };

  // Format hour for display
  const formatHour = (hour: number): string => {
    if (hour === 0) return "12 AM";
    if (hour === 12) return "12 PM";
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  // Current time
  const currentHour = new Date().getHours();
  const currentAngle = hourToAngle(currentHour);
  const nowPos = polarToCartesian(currentAngle, OUTER_RADIUS);

  // Phase data with icons from PHASE_STYLES
  const phases = [
    {
      name: "Night",
      emoji: nightPhase?.emoji || PHASE_STYLES[Phase.NIGHT].emoji,
    },
    {
      name: "Morning",
      emoji: morningPhase?.emoji || PHASE_STYLES[Phase.MORNING].emoji,
    },
    {
      name: "Afternoon",
      emoji: afternoonPhase?.emoji || PHASE_STYLES[Phase.AFTERNOON].emoji,
    },
    {
      name: "Evening",
      emoji: eveningPhase?.emoji || PHASE_STYLES[Phase.EVENING].emoji,
    },
  ];

  return (
    <div className="relative w-full max-w-md mx-auto py-8 select-none">
      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto select-none"
        onMouseMove={(e) => handlePointerMove(e.nativeEvent)}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchMove={(e) => handlePointerMove(e.nativeEvent)}
        onTouchEnd={handlePointerUp}
      >
        {/* Subtle drop shadow definition */}
        <defs>
          <filter
            id="pointer-shadow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
            <feOffset dx="0" dy="1" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="inner-glow" cx="50%" cy="50%" r="50%">
            <stop offset="85%" stopColor="#0f172a" stopOpacity="0" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.2" />
          </radialGradient>
        </defs>

        {/* Inner circle with subtle glow effect */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={INNER_RADIUS}
          fill="url(#inner-glow)"
          stroke="#334155"
          strokeWidth={1}
        />

        {/* Outer boundary - very subtle */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={OUTER_RADIUS}
          fill="none"
          stroke="#334155"
          strokeWidth={0.5}
        />

        {/* Phase donut segments */}
        {pointerHours.map((_, index) => {
          const startHour = pointerHours[index];
          const endHour = pointerHours[(index + 1) % 4];
          const color = phaseColors[index];

          const startAngle = hourToAngle(startHour);
          let endAngle = hourToAngle(endHour);

          // Handle midnight wrap
          if (endAngle < startAngle) {
            endAngle += 360;
          }

          return (
            <path
              key={`segment-${index}`}
              d={describeDonutArc(
                startAngle,
                endAngle,
                OUTER_RADIUS,
                INNER_RADIUS
              )}
              fill={color}
              stroke="#334155"
              strokeWidth={0.5}
              pointerEvents="none"
            />
          );
        })}

        {/* Phase icons in the middle of each arc */}
        {pointerHours.map((_, index) => {
          const startHour = pointerHours[index];
          const endHour = pointerHours[(index + 1) % 4];

          const startAngle = hourToAngle(startHour);
          let endAngle = hourToAngle(endHour);

          // Handle midnight wrap
          if (endAngle < startAngle) {
            endAngle += 360;
          }

          // Middle of the arc
          const midAngle = startAngle + (endAngle - startAngle) / 2;
          const midRadius = (OUTER_RADIUS + INNER_RADIUS) / 2;
          const iconPos = polarToCartesian(midAngle, midRadius);

          return (
            <text
              key={`icon-${index}`}
              x={iconPos.x}
              y={iconPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="28"
              pointerEvents="none"
              opacity={0.9}
            >
              {phases[index].emoji}
            </text>
          );
        })}

        {/* NOW indicator - subtle monochromatic dot with accent ring */}
        <g pointerEvents="none">
          <circle
            cx={nowPos.x}
            cy={nowPos.y}
            r={8}
            fill="none"
            stroke="#64748b"
            strokeWidth={1.5}
            opacity={0.4}
          />
          <circle
            cx={nowPos.x}
            cy={nowPos.y}
            r={4}
            fill="#0f172a"
            stroke="#cbd5e1"
            strokeWidth={1.5}
          />
        </g>

        {/* Pointers on the outer edge with hour labels */}
        {pointerHours.map((hour, index) => {
          const angle = hourToAngle(hour);
          const pos = polarToCartesian(angle, OUTER_RADIUS);
          const labelPos = polarToCartesian(angle, OUTER_RADIUS + 40);
          const isDragging = draggingPointer === index;

          return (
            <g
              key={`pointer-${hour}-${index}`}
              onMouseDown={() => handlePointerDown(index)}
              onTouchStart={() => handlePointerDown(index)}
              className="cursor-grab active:cursor-grabbing"
            >
              {/* Outer ring - shows on hover/drag */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={18}
                fill="none"
                stroke="#475569"
                strokeWidth={1}
                opacity={isDragging ? 0.6 : 0}
                className="transition-opacity hover:opacity-40"
              />

              {/* Main pointer with shadow */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={12}
                fill="#f8fafc"
                stroke="#334155"
                strokeWidth={2}
                filter="url(#pointer-shadow)"
                className="transition-all hover:fill-slate-100"
              />

              {/* Inner dot for visual interest */}
              <circle
                cx={pos.x}
                cy={pos.y}
                r={4}
                fill="#475569"
                pointerEvents="none"
              />

              {/* Hour label */}
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-sm font-mono font-medium fill-slate-700 dark:fill-slate-300"
                pointerEvents="none"
              >
                {formatHour(hour)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
