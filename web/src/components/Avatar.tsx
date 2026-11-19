import { useId, type CSSProperties, type ReactNode } from "react";
import {
  BACKGROUNDS,
  colorHex,
  DEFAULT_AVATAR,
  EYE_COLORS,
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
  type AvatarConfig,
} from "../../../shared/avatar";
import type { Mood } from "../../../shared/game";

export interface AvatarProps {
  config?: AvatarConfig;
  mood?: Mood;
  /** 0-5: unlocks gear (sweatband, towel, medals, aura) */
  level?: number;
  /** Shows a crown */
  leader?: boolean;
  size?: number | string;
  /** Show background color */
  background?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
  animated?: boolean;
}

/** Mixes a hex color with black (amount < 0) or white (amount > 0). */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const t = amount < 0 ? 0 : 255;
  const p = Math.abs(amount);
  const mix = (c: number) => Math.round((t - c) * p + c);
  return `#${((1 << 24) | (mix(r) << 16) | (mix(g) << 8) | mix(b)).toString(16).slice(1)}`;
}

const INK = "#2B2238";
const MOUTH = "#6E2B33";
const HATS = new Set(["cap", "beanie", "hardhat"]);

export function Avatar({
  config = DEFAULT_AVATAR,
  mood = "neutral",
  level = 0,
  leader = false,
  size = 96,
  background = true,
  className,
  style,
  title,
  animated = true,
}: AvatarProps) {
  const uid = useId().replace(/:/g, "");
  const skin = colorHex(SKIN_TONES, config.skin);
  const skinShadow = shade(skin, -0.14);
  const skinDeep = shade(skin, -0.32);
  const hair = colorHex(HAIR_COLORS, config.hairColor);
  const hairDark = shade(hair, -0.25);
  const hairLight = shade(hair, 0.18);
  const eye = colorHex(EYE_COLORS, config.eyes);
  const outfit = colorHex(OUTFIT_COLORS, config.outfitColor);
  const bg = colorHex(BACKGROUNDS, config.bg);
  const hasHat = HATS.has(config.accessory);

  return (
    <svg
      viewBox="12 8 176 176"
      width={size}
      height={size}
      className={`avatar${animated ? " avatar--animated" : ""}${className ? ` ${className}` : ""}`}
      style={style}
      role="img"
      aria-label={title ?? "Avatar"}
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <radialGradient id={`aura-${uid}`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#FFF6C9" stopOpacity="1" />
          <stop offset="55%" stopColor="#FFD84D" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#FFB800" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`face-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={shade(skin, 0.06)} />
          <stop offset="100%" stopColor={skin} />
        </linearGradient>
      </defs>

      {background ? <rect width="200" height="200" fill={bg} /> : null}
      {background ? <circle cx="100" cy="92" r="78" fill={shade(bg, 0.35)} opacity="0.55" /> : null}
      {level >= 5 ? <circle cx="100" cy="96" r="96" fill={`url(#aura-${uid})`} className="avatar-aura" /> : null}

      <BackHair style={config.hair} hair={hair} hairDark={hairDark} hasHat={hasHat} />

      {/* Neck and shoulders */}
      <path d="M86 124 L86 158 Q100 166 114 158 L114 124 Z" fill={skinShadow} />
      <Outfit kind={config.outfit} color={outfit} skin={skin} skinShadow={skinShadow} />
      {level >= 2 ? <Towel /> : null}
      {level >= 3 ? <Medal gold={level >= 4} /> : null}

      {/* Head */}
      <g className="avatar-head">
        <ellipse cx="57.5" cy="100" rx="8.5" ry="11" fill={skin} />
        <ellipse cx="142.5" cy="100" rx="8.5" ry="11" fill={skin} />
        <ellipse cx="58.5" cy="100" rx="4" ry="6" fill={skinShadow} />
        <ellipse cx="141.5" cy="100" rx="4" ry="6" fill={skinShadow} />
        <path
          d="M57 92 C57 61 76 46 100 46 C124 46 143 61 143 92 C143 121 125 142 100 142 C75 142 57 121 57 92 Z"
          fill={`url(#face-${uid})`}
        />
        {config.accessory === "earrings" ? (
          <>
            <circle cx="56" cy="113" r="3.4" fill="#F2C14E" stroke="#C9952A" strokeWidth="1" />
            <circle cx="144" cy="113" r="3.4" fill="#F2C14E" stroke="#C9952A" strokeWidth="1" />
          </>
        ) : null}

        <FacialHair kind={config.facialHair} hair={hair} hairDark={hairDark} />

        {/* Cheeks */}
        <ellipse cx="74" cy="114" rx="7.5" ry="4.5" fill="#FF6F7D" opacity={mood === "ecstatic" ? 0.38 : 0.22} />
        <ellipse cx="126" cy="114" rx="7.5" ry="4.5" fill="#FF6F7D" opacity={mood === "ecstatic" ? 0.38 : 0.22} />

        <Eyes mood={mood} eye={eye} skin={skin} />
        <Brows kind={config.brows} mood={mood} color={config.hair === "bald" ? skinDeep : hairDark} />

        {/* Nose */}
        <path d="M100 103 Q105 111 99 113.5" fill="none" stroke={skinDeep} strokeWidth="2.6" strokeLinecap="round" opacity="0.75" />

        <Mouth mood={mood} />
        {config.facialHair === "mustache" || config.facialHair === "goatee" || config.facialHair === "beard" || config.facialHair === "full_beard" ? (
          <path
            d="M85 119.5 C89 112.5 97 112 100 115.5 C103 112 111 112.5 115 119.5 C109 118.5 105 117.5 100 119.5 C95 117.5 91 118.5 85 119.5 Z"
            fill={hairDark}
          />
        ) : null}

        <FrontHair style={config.hair} hair={hair} hairDark={hairDark} hairLight={hairLight} hasHat={hasHat} />
        <Glasses kind={config.glasses} />
        {level >= 1 && !hasHat && config.accessory !== "headphones" ? <Sweatband /> : null}
        <Accessory kind={config.accessory} color={outfit} />
      </g>

      {mood === "worried" || mood === "sad" || mood === "guilty" ? <SweatDrop /> : null}
      {mood === "guilty" ? <Snack skin={skin} /> : null}
      {mood === "ecstatic" || level >= 5 ? <Sparkles /> : null}
      {leader ? <Crown /> : null}
    </svg>
  );
}

function BackHair({ style, hair, hairDark, hasHat }: { style: AvatarConfig["hair"]; hair: string; hairDark: string; hasHat: boolean }) {
  switch (style) {
    case "long":
      return (
        <path
          d="M54 96 C46 58 70 36 100 36 C130 36 154 58 146 96 C150 120 154 146 156 172 C142 182 126 176 120 164 L80 164 C74 176 58 182 44 172 C46 146 50 120 54 96 Z"
          fill={hairDark}
        />
      );
    case "bob":
      return (
        <path
          d="M49 118 C42 68 66 38 100 38 C134 38 158 68 151 118 C151 132 141 138 132 133 L68 133 C59 138 49 132 49 118 Z"
          fill={hairDark}
        />
      );
    case "ponytail":
      return (
        <g>
          <path d="M126 54 C158 56 170 96 160 134 C154 154 138 158 140 138 C146 108 146 80 124 66 Z" fill={hairDark} />
          <circle cx="128" cy="60" r="7" fill={shade(hair, -0.4)} />
        </g>
      );
    case "afro":
      return (
        <g fill={hair}>
          {(hasHat
            ? [
                [60, 78, 22],
                [140, 78, 22],
                [54, 100, 18],
                [146, 100, 18],
              ]
            : [
                [100, 44, 50],
                [60, 66, 26],
                [140, 66, 26],
                [54, 96, 20],
                [146, 96, 20],
                [74, 34, 24],
                [126, 34, 24],
                [100, 26, 26],
              ]
          ).map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    case "curly":
      return hasHat ? null : (
        <g fill={hairDark}>
          {[
            [56, 86, 14],
            [144, 86, 14],
            [54, 106, 11],
            [146, 106, 11],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    case "bun":
      return hasHat ? null : (
        <g>
          <circle cx="100" cy="34" r="17" fill={hair} />
          <path d="M88 34 Q100 42 112 34" stroke={hairDark} strokeWidth="2.5" fill="none" />
          <rect x="91" y="44" width="18" height="6" rx="3" fill={shade(hair, -0.4)} />
        </g>
      );
    default:
      return null;
  }
}

function FrontHair({
  style,
  hair,
  hairDark,
  hairLight,
  hasHat,
}: {
  style: AvatarConfig["hair"];
  hair: string;
  hairDark: string;
  hairLight: string;
  hasHat: boolean;
}) {
  switch (style) {
    case "short":
      return (
        <g>
          <path
            d="M55 94 C51 62 70 39 100 39 C130 39 149 62 145 94 C142 81 138 73 132 68 C121 72 105 70 93 63 C85 70 73 72 65 70 C60 77 57 85 55 94 Z"
            fill={hair}
          />
          <path d="M80 50 C88 45 104 44 114 47" stroke={hairLight} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    case "side":
      return (
        <g>
          <path
            d="M55 96 C49 60 72 37 102 38 C132 39 151 62 145 96 C142 80 138 71 131 65 C115 67 93 67 76 57 C67 66 60 78 55 96 Z"
            fill={hair}
          />
          <path d="M76 57 C79 50 84 45 90 41" stroke={hairDark} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M96 46 C110 44 124 48 133 56" stroke={hairLight} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.55" />
        </g>
      );
    case "spiky":
      return (
        <path
          d="M56 92 L51 66 L62 70 L59 49 L74 57 L77 36 L90 51 L100 32 L110 51 L123 36 L126 57 L141 49 L138 70 L149 66 L144 92 C140 81 134 73 128 69 C118 73 106 69 100 64 C94 69 82 73 72 69 C66 73 60 81 56 92 Z"
          fill={hair}
          stroke={hairDark}
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      );
    case "buzz":
      return (
        <path
          d="M57 88 C55 58 76 44 100 44 C124 44 145 58 143 88 C140 74 134 66 126 61 C112 57 88 57 74 61 C66 66 60 74 57 88 Z"
          fill={hair}
          opacity="0.88"
        />
      );
    case "curly":
      return (
        <g fill={hair}>
          {(hasHat
            ? [
                [62, 84, 10],
                [138, 84, 10],
              ]
            : [
                [60, 80, 13],
                [58, 64, 13],
                [66, 50, 14],
                [79, 41, 14],
                [93, 36, 14],
                [108, 36, 14],
                [122, 41, 14],
                [135, 50, 14],
                [142, 64, 13],
                [140, 80, 13],
                [75, 63, 10],
                [89, 59, 10],
                [104, 59, 10],
                [118, 61, 10],
                [129, 67, 9],
                [68, 70, 8],
              ]
          ).map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    case "long":
      return (
        <g fill={hair}>
          <path d="M55 98 C49 60 72 39 100 39 C128 39 151 60 145 98 C140 78 128 63 103 57 C101 61 99 61 97 57 C72 63 60 78 55 98 Z" />
          <path d="M57 86 C49 112 49 148 43 172 C55 178 66 170 70 158 C65 136 63 110 66 90 Z" />
          <path d="M143 86 C151 112 151 148 157 172 C145 178 134 170 130 158 C135 136 137 110 134 90 Z" />
        </g>
      );
    case "bob":
      return (
        <path
          d="M53 104 C48 62 71 41 100 41 C129 41 152 62 147 104 C145 89 141 79 136 73 Q100 79 64 73 C59 79 55 89 53 104 Z"
          fill={hair}
        />
      );
    case "bun":
    case "ponytail":
      return (
        <g>
          <path d="M56 90 C54 60 74 43 100 43 C126 43 146 60 144 90 C138 70 122 59 100 59 C78 59 62 70 56 90 Z" fill={hair} />
          <path d="M78 52 C88 48 112 48 122 52" stroke={hairDark} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.5" />
        </g>
      );
    case "afro":
      return (
        <g fill={hair}>
          {[
            [66, 70, 12],
            [80, 64, 12],
            [94, 61, 12],
            [108, 61, 12],
            [121, 64, 12],
            [134, 70, 12],
          ].map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    case "mohawk":
      return (
        <g>
          <path d="M58 88 C56 64 74 48 100 48 C126 48 144 64 142 88 C136 72 120 64 100 64 C80 64 64 72 58 88 Z" fill={hair} opacity="0.35" />
          {hasHat ? null : (
            <path
              d="M88 66 L84 44 L92 50 L92 26 L100 36 L106 16 L110 34 L118 30 L114 50 L120 46 L112 66 C106 62 94 62 88 66 Z"
              fill={hair}
              stroke={hairDark}
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          )}
        </g>
      );
    case "receding":
      return (
        <g fill={hair}>
          <path d="M56 98 C53 78 57 63 66 54 C71 62 73 72 70 82 C65 86 60 91 56 98 Z" />
          <path d="M144 98 C147 78 143 63 134 54 C129 62 127 72 130 82 C135 86 140 91 144 98 Z" />
          <path d="M84 50 C92 47 108 47 116 50" stroke={hair} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.6" />
        </g>
      );
    case "bald":
      return <ellipse cx="84" cy="58" rx="14" ry="7" fill="#FFFFFF" opacity="0.28" transform="rotate(-18 84 58)" />;
    default:
      return null;
  }
}

function Eyes({ mood, eye, skin }: { mood: Mood; eye: string; skin: string }) {
  if (mood === "ecstatic") {
    return (
      <g fill="none" stroke={INK} strokeWidth="3.6" strokeLinecap="round">
        <path d="M73 100 Q82 89 91 100" />
        <path d="M109 100 Q118 89 127 100" />
      </g>
    );
  }
  const look = mood === "guilty" ? 3 : 0;
  const lookY = mood === "sad" ? 2 : 0;
  const one = (cx: number): ReactNode => (
    <g key={cx}>
      <ellipse cx={cx} cy="98" rx="8.6" ry="9.4" fill="#FFFFFF" />
      <circle cx={cx + look} cy={98 + lookY} r="5.4" fill={eye} />
      <circle cx={cx + look} cy={98 + lookY} r="2.7" fill={INK} />
      <circle cx={cx + look + 1.9} cy={96 + lookY} r="1.7" fill="#FFFFFF" />
      {mood === "sad" || mood === "worried" ? (
        <path d={`M${cx - 9.5} ${mood === "sad" ? 95 : 92} Q${cx} ${mood === "sad" ? 88 : 86} ${cx + 9.5} ${mood === "sad" ? 95 : 92} L${cx + 9.5} 86 L${cx - 9.5} 86 Z`} fill={skin} />
      ) : null}
    </g>
  );
  return <g className="avatar-eyes">{[one(82), one(118)]}</g>;
}

function Brows({ kind, mood, color }: { kind: AvatarConfig["brows"]; mood: Mood; color: string }) {
  const width = kind === "thick" ? 5.6 : kind === "thin" ? 2.2 : 3.8;
  const arch = kind === "arched" ? 6 : 3;
  // [outer, inner] y positions for left brow (right brow is mirrored)
  let outer = 84;
  let inner = 84;
  let lift = 0;
  if (mood === "ecstatic") lift = -4;
  if (mood === "worried" || mood === "sad") {
    outer = 86;
    inner = 79;
  }
  if (mood === "happy") lift = -1;
  const left = `M72 ${outer + lift} Q81 ${Math.min(outer, inner) - arch + lift} 90 ${inner + lift}`;
  const rightLift = mood === "guilty" ? -5 : 0;
  const right = `M110 ${inner + lift + rightLift} Q119 ${Math.min(outer, inner) - arch + lift + rightLift} 128 ${outer + lift + rightLift}`;
  return (
    <g fill="none" stroke={color} strokeWidth={width} strokeLinecap="round">
      <path d={left} />
      <path d={right} />
    </g>
  );
}

function Mouth({ mood }: { mood: Mood }) {
  switch (mood) {
    case "ecstatic":
      return (
        <g>
          <path d="M85 119 Q100 140 115 119 Z" fill={MOUTH} />
          <path d="M88 120.5 L112 120.5 L110.5 124 L89.5 124 Z" fill="#FFFFFF" />
          <ellipse cx="100" cy="131" rx="7" ry="3.6" fill="#F07A86" />
        </g>
      );
    case "happy":
      return <path d="M87 120 Q100 133 113 120" fill="none" stroke={MOUTH} strokeWidth="3.6" strokeLinecap="round" />;
    case "worried":
      return (
        <path d="M88 126 Q94 121.5 100 126 Q106 130.5 112 126" fill="none" stroke={MOUTH} strokeWidth="3.4" strokeLinecap="round" />
      );
    case "sad":
      return <path d="M88 129 Q100 118 112 129" fill="none" stroke={MOUTH} strokeWidth="3.6" strokeLinecap="round" />;
    case "guilty":
      return (
        <g>
          <path d="M92 125 Q102 130 111 122" fill="none" stroke={MOUTH} strokeWidth="3.4" strokeLinecap="round" />
          <circle cx="114" cy="130" r="1.6" fill="#8A5A2B" />
          <circle cx="108" cy="134" r="1.3" fill="#8A5A2B" />
          <circle cx="118" cy="135" r="1.1" fill="#8A5A2B" />
        </g>
      );
    default:
      return <path d="M90 123 Q100 129 110 123" fill="none" stroke={MOUTH} strokeWidth="3.4" strokeLinecap="round" />;
  }
}

function FacialHair({ kind, hair, hairDark }: { kind: AvatarConfig["facialHair"]; hair: string; hairDark: string }) {
  switch (kind) {
    case "stubble":
      return (
        <path
          d="M60 104 C62 128 80 142 100 142 C120 142 138 128 140 104 C134 118 123 125 113 125 C107 121 93 121 87 125 C77 125 66 118 60 104 Z"
          fill={hairDark}
          opacity="0.28"
        />
      );
    case "goatee":
      return <path d="M91 129 Q100 125 109 129 L107 141 Q100 146 93 141 Z" fill={hair} />;
    case "beard":
      return (
        <path
          d="M58 98 C58 128 76 149 100 149 C124 149 142 128 142 98 C138 111 132 119 124 123 C116 127 108 124 100 128 C92 124 84 127 76 123 C68 119 62 111 58 98 Z"
          fill={hair}
        />
      );
    case "full_beard":
      return (
        <path
          d="M56 96 C53 138 76 166 100 168 C124 166 147 138 144 96 C140 112 133 121 124 124 C116 128 108 125 100 129 C92 125 84 128 76 124 C67 121 60 112 56 96 Z"
          fill={hair}
        />
      );
    default:
      return null;
  }
}

function Glasses({ kind }: { kind: AvatarConfig["glasses"] }) {
  if (kind === "none") return null;
  const frame = "#2B2238";
  if (kind === "round") {
    return (
      <g fill="none" stroke={frame} strokeWidth="3">
        <circle cx="82" cy="98" r="12.5" fill="#FFFFFF" fillOpacity="0.12" />
        <circle cx="118" cy="98" r="12.5" fill="#FFFFFF" fillOpacity="0.12" />
        <path d="M94.5 96 Q100 92 105.5 96" />
        <path d="M69.5 96 L58 92" />
        <path d="M130.5 96 L142 92" />
      </g>
    );
  }
  if (kind === "square") {
    return (
      <g fill="none" stroke={frame} strokeWidth="3.4">
        <rect x="68" y="87" width="28" height="22" rx="6" fill="#FFFFFF" fillOpacity="0.12" />
        <rect x="104" y="87" width="28" height="22" rx="6" fill="#FFFFFF" fillOpacity="0.12" />
        <path d="M96 95 Q100 92 104 95" />
        <path d="M68 94 L58 91" />
        <path d="M132 94 L142 91" />
      </g>
    );
  }
  return (
    <g>
      <path d="M66 89 L97 89 Q97 109 83 109 Q67 109 66 89 Z" fill="#1E1A2B" />
      <path d="M103 89 L134 89 Q133 109 117 109 Q103 109 103 89 Z" fill="#1E1A2B" />
      <path d="M71 93 L80 93" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <path d="M108 93 L117 93" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
      <path d="M97 91 L103 91 M66 90 L58 88 M134 90 L142 88" stroke="#1E1A2B" strokeWidth="3" />
    </g>
  );
}

function Accessory({ kind, color }: { kind: AvatarConfig["accessory"]; color: string }) {
  switch (kind) {
    case "cap":
      return (
        <g>
          <path d="M54 84 C52 52 74 35 100 35 C126 35 148 52 146 84 C128 77 72 77 54 84 Z" fill={color} />
          <path d="M100 35 L100 78" stroke={shade(color, -0.2)} strokeWidth="2" opacity="0.6" />
          <circle cx="100" cy="36" r="4" fill={shade(color, -0.25)} />
          <path d="M52 84 C72 74 128 74 148 84 C150 92 140 96 100 94 C60 96 50 92 52 84 Z" fill={shade(color, -0.22)} />
        </g>
      );
    case "beanie":
      return (
        <g>
          <path d="M54 80 C52 46 76 30 100 30 C124 30 148 46 146 80 Z" fill={color} />
          <rect x="51" y="68" width="98" height="18" rx="9" fill={shade(color, -0.18)} />
          {[62, 74, 86, 98, 110, 122, 134].map((x) => (
            <path key={x} d={`M${x} 71 L${x} 83`} stroke={shade(color, -0.32)} strokeWidth="2" strokeLinecap="round" />
          ))}
          <circle cx="100" cy="27" r="9" fill={shade(color, 0.45)} />
        </g>
      );
    case "headphones":
      return (
        <g>
          <path d="M53 98 C46 38 154 38 147 98" fill="none" stroke="#2B2238" strokeWidth="7" strokeLinecap="round" />
          <rect x="43" y="84" width="17" height="30" rx="8" fill={color} stroke="#2B2238" strokeWidth="3" />
          <rect x="140" y="84" width="17" height="30" rx="8" fill={color} stroke="#2B2238" strokeWidth="3" />
        </g>
      );
    case "hardhat":
      return (
        <g>
          <path d="M53 80 C53 46 74 31 100 31 C126 31 147 46 147 80 Z" fill="#F5C527" />
          <path d="M90 33 C88 50 88 66 90 80 L110 80 C112 66 112 50 110 33 C104 31 96 31 90 33 Z" fill="#FFDD55" />
          <rect x="46" y="76" width="108" height="10" rx="5" fill="#E0A800" />
          <path d="M60 60 Q64 46 78 40" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />
        </g>
      );
    default:
      return null;
  }
}

function Outfit({ kind, color, skin, skinShadow }: { kind: AvatarConfig["outfit"]; color: string; skin: string; skinShadow: string }) {
  const dark = shade(color, -0.2);
  const torso = "M28 200 C30 172 56 156 100 156 C144 156 170 172 172 200 Z";
  switch (kind) {
    case "hoodie":
      return (
        <g>
          <path d="M70 156 C66 142 80 134 100 134 C120 134 134 142 130 156 Z" fill={dark} />
          <path d={torso} fill={color} />
          <path d="M80 158 Q100 176 120 158" fill="none" stroke={dark} strokeWidth="5" strokeLinecap="round" />
          <path d="M92 170 L90 186 M108 170 L110 186" stroke="#F3F1EC" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="90" cy="187" r="2.2" fill="#F3F1EC" />
          <circle cx="110" cy="187" r="2.2" fill="#F3F1EC" />
        </g>
      );
    case "shirt":
      return (
        <g>
          <path d={torso} fill={color} />
          <path d="M86 156 L100 176 L114 156 Z" fill={skin} />
          <path d="M84 152 L100 172 L90 180 L76 160 Z" fill={shade(color, 0.35)} stroke={dark} strokeWidth="1.5" />
          <path d="M116 152 L100 172 L110 180 L124 160 Z" fill={shade(color, 0.35)} stroke={dark} strokeWidth="1.5" />
          <path d="M100 176 L100 200" stroke={dark} strokeWidth="1.5" />
          <circle cx="100" cy="186" r="1.8" fill={dark} />
          <circle cx="100" cy="196" r="1.8" fill={dark} />
        </g>
      );
    case "polo":
      return (
        <g>
          <path d={torso} fill={color} />
          <path d="M90 156 L100 170 L110 156 Z" fill={skinShadow} />
          <path d="M82 154 L100 162 L92 172 Z" fill={dark} />
          <path d="M118 154 L100 162 L108 172 Z" fill={dark} />
          <rect x="97" y="164" width="6" height="18" rx="2" fill={dark} opacity="0.5" />
          <circle cx="100" cy="170" r="1.6" fill="#F3F1EC" />
          <circle cx="100" cy="177" r="1.6" fill="#F3F1EC" />
        </g>
      );
    case "sweater":
      return (
        <g>
          <path d={torso} fill={color} />
          <path d="M82 158 Q100 172 118 158" fill="none" stroke={dark} strokeWidth="7" strokeLinecap="round" />
          {[52, 64, 136, 148].map((x) => (
            <path key={x} d={`M${x} ${x < 100 ? 186 - (x - 52) * 0.3 : 182 + (x - 136) * 0.3} l4 6 l4 -6`} fill="none" stroke={dark} strokeWidth="2" opacity="0.6" />
          ))}
        </g>
      );
    case "overalls":
      return (
        <g>
          <path d={torso} fill="#ECE8E1" />
          <path d="M84 158 Q100 170 116 158" fill="none" stroke="#CFC9BF" strokeWidth="3" />
          <path d="M70 200 L72 176 Q100 170 128 176 L130 200 Z" fill={color} />
          <path d="M66 162 L76 180 M134 162 L124 180" stroke={color} strokeWidth="9" strokeLinecap="round" />
          <circle cx="76" cy="180" r="3.5" fill="#F5C527" />
          <circle cx="124" cy="180" r="3.5" fill="#F5C527" />
          <rect x="92" y="184" width="16" height="10" rx="2" fill={dark} />
        </g>
      );
    default:
      return (
        <g>
          <path d={torso} fill={color} />
          <path d="M84 157 Q100 172 116 157" fill="none" stroke={dark} strokeWidth="4" strokeLinecap="round" />
        </g>
      );
  }
}

function Sweatband() {
  return (
    <g>
      <path d="M56 76 C76 64 124 64 144 76 L144 86 C124 74 76 74 56 86 Z" fill="#E5484D" />
      <path d="M56 81 C76 69 124 69 144 81" stroke="#FFFFFF" strokeWidth="2.4" fill="none" />
    </g>
  );
}

function Towel() {
  return (
    <g>
      <path d="M40 176 C50 160 66 154 78 158 L86 200 L58 200 C56 190 48 182 40 176 Z" fill="#FFFFFF" />
      <path d="M50 172 C58 164 68 160 76 162" stroke="#7FB4F0" strokeWidth="3" fill="none" />
      <path d="M54 182 C62 174 72 170 80 172" stroke="#7FB4F0" strokeWidth="3" fill="none" />
    </g>
  );
}

function Medal({ gold }: { gold: boolean }) {
  const metal = gold ? "#F5C527" : "#CD8746";
  const rim = gold ? "#D9A400" : "#A9662E";
  return (
    <g>
      <path d="M86 157 L98 168 M114 157 L102 168" stroke={gold ? "#3B82F6" : "#E5484D"} strokeWidth="6" strokeLinecap="round" />
      <g transform="translate(0 -12)">
        <circle cx="100" cy="184" r="10" fill={metal} stroke={rim} strokeWidth="2.5" />
        <path d="M100 177.5 L102 182 L106.8 182.4 L103.2 185.5 L104.3 190.2 L100 187.7 L95.7 190.2 L96.8 185.5 L93.2 182.4 L98 182 Z" fill={rim} />
      </g>
    </g>
  );
}

function SweatDrop() {
  return (
    <g className="avatar-sweat">
      <path d="M146 64 C141 73 139 77 139 80.5 C139 84.5 142.2 87 146 87 C149.8 87 153 84.5 153 80.5 C153 77 151 73 146 64 Z" fill="#8FD3FF" stroke="#4AA8E8" strokeWidth="1.2" />
      <ellipse cx="143.5" cy="80" rx="1.6" ry="2.6" fill="#FFFFFF" opacity="0.8" />
    </g>
  );
}

function Snack({ skin }: { skin: string }) {
  return (
    <g className="avatar-snack" transform="rotate(-24 150 166)">
      <rect x="130" y="152" width="44" height="20" rx="4" fill="#E5484D" />
      <path d="M130 152 L124 148 L124 176 L130 172 Z" fill="#C2373B" />
      <rect x="138" y="157" width="22" height="10" rx="3" fill="#FFF3D6" />
      <path d="M174 152 Q170 156 174 160 Q170 164 174 168 Q170 171 174 172 L178 172 L178 152 Z" fill="#6B3E1F" />
      <ellipse cx="146" cy="176" rx="10" ry="8" fill={skin} stroke={shade(skin, -0.2)} strokeWidth="1.5" />
    </g>
  );
}

function Sparkles() {
  const star = (x: number, y: number, s: number, key: string) => (
    <path
      key={key}
      d={`M${x} ${y - s} Q${x} ${y} ${x + s} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s} ${y} Q${x} ${y} ${x} ${y - s} Z`}
      fill="#FFD84D"
      stroke="#F2B100"
      strokeWidth="1"
    />
  );
  return <g className="avatar-sparkles">{[star(30, 46, 9, "a"), star(172, 40, 7, "b"), star(166, 128, 6, "c"), star(36, 132, 5, "d")]}</g>;
}

function Crown() {
  return (
    <g transform="translate(118 12) rotate(16) scale(0.9)">
      <path d="M2 30 L6 6 L16 18 L24 2 L32 18 L42 6 L46 30 Z" fill="#FFD23F" stroke="#D9A400" strokeWidth="2" strokeLinejoin="round" />
      <rect x="2" y="27" width="44" height="7" rx="2" fill="#F2B100" />
      <circle cx="24" cy="21" r="3" fill="#E5484D" />
      <circle cx="12" cy="23" r="2" fill="#3B82F6" />
      <circle cx="36" cy="23" r="2" fill="#38A169" />
    </g>
  );
}
