/* WallFlow companion overlay — selectable desktop pet: cat, dog, slime blob.
   Shared rig contract (queried defensively — each character may omit parts):
     .lean          reaction/idle animation layer (never fights breathing)
     .char-root     breathing loop + .sleeping flag + Zzz
     .head, .ear-l/.ear-r, .eye-l/.eye-r, .pupil-l/.pupil-r,
     .lid-l/.lid-r, .lid-arc-l/.lid-arc-r, .mouth-normal,
     .mouth-yawn > .yawn-oral/.tongue, .tail, .zzz

   Reacts to: cursor (pupils/head follow + proximity perk + hover gaze),
   brightness (squint/yawn + sun/moon emoji), clicks (left = pet when the
   cursor is on the companion — hearts, combo 💕, affection meter; right
   = startle / boop), system volume (dance🎵 / wince 💦), wallpaper
   changes (✨ stretch), settings notices (💡 head tilt), fast swipes
   (startle ❗), idle animation pool, 23:00–07:00 sleep (😴 + Zzz).
   Floating emoji (.fx) announce states/actions; petting raises st.love
   (blush boost, faster wag, livelier idles). */
(() => {
  const host = document.getElementById('companion');
  if (!host) return;

  /* ---------------- characters ---------------- */

  const CAT_SVG = `
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
       style="--breathe-dur:3.4s;--sleep-breathe:5.2s;--tail-dur:4.6s">
    <defs>
      <clipPath id="wfEyeClipL"><ellipse cx="80" cy="95" rx="15" ry="15"/></clipPath>
      <clipPath id="wfEyeClipR"><ellipse cx="120" cy="95" rx="15" ry="15"/></clipPath>
      <clipPath id="wfCatHeadClip"><path d="M100,49 C118,49 134,54 143,66 C149,74 151,84 150,93 C149,101 146,107 143,111 C146,117 145,125 139,130 C133,136 119,141 100,141 C81,141 67,136 61,130 C55,125 54,117 57,111 C54,107 51,101 50,93 C49,84 51,74 57,66 C66,54 82,49 100,49 Z"/></clipPath>
      <clipPath id="wfCatBodyClip"><path d="M100,122 C122,122 139,133 144,153 C148,169 145,184 137,191 C131,196 122,197 112,195 C106,194 104,192 100,192 C96,192 94,194 88,195 C78,197 69,196 63,191 C55,184 52,169 56,153 C61,133 78,122 100,122 Z"/></clipPath>
      <linearGradient id="wfCatFur" gradientUnits="userSpaceOnUse" x1="36" y1="30" x2="166" y2="196">
        <stop offset="0" stop-color="#e9edff"/>
        <stop offset="0.5" stop-color="#c6cff5"/>
        <stop offset="1" stop-color="#93a2dd"/>
      </linearGradient>
      <linearGradient id="wfCatTail" gradientUnits="userSpaceOnUse" x1="134" y1="180" x2="177" y2="150">
        <stop offset="0" stop-color="#98a6da"/>
        <stop offset="0.55" stop-color="#c9d2f6"/>
        <stop offset="1" stop-color="#f2f4ff"/>
      </linearGradient>
      <linearGradient id="wfCatSclera" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.72" stop-color="#f6f8ff"/>
        <stop offset="1" stop-color="#e3e9fb"/>
      </linearGradient>
      <linearGradient id="wfCatIris" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffe89a"/>
        <stop offset="0.45" stop-color="#ffc454"/>
        <stop offset="1" stop-color="#cf7f1e"/>
      </linearGradient>
      <linearGradient id="wfCatInner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffd3e2"/>
        <stop offset="1" stop-color="#e88fb2"/>
      </linearGradient>
      <linearGradient id="wfCatNose" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f6a9c1"/>
        <stop offset="1" stop-color="#dd6f95"/>
      </linearGradient>
      <radialGradient id="wfCatBelly">
        <stop offset="0" stop-color="#fbfcff" stop-opacity="0.95"/>
        <stop offset="0.7" stop-color="#e9edfd" stop-opacity="0.85"/>
        <stop offset="1" stop-color="#e9edfd" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="wfCatMuzzle">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.7" stop-color="#f4f7ff"/>
        <stop offset="1" stop-color="#eef2ff"/>
      </radialGradient>
      <radialGradient id="wfCatChin">
        <stop offset="0" stop-color="#4d5690" stop-opacity="0.30"/>
        <stop offset="1" stop-color="#4d5690" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="wfCatBlush">
        <stop offset="0" stop-color="#f78bb0" stop-opacity="0.65"/>
        <stop offset="0.55" stop-color="#f4a0c0" stop-opacity="0.36"/>
        <stop offset="1" stop-color="#f0a8c0" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="wfCatShadow">
        <stop offset="0" stop-color="#1a1f3a" stop-opacity="0.42"/>
        <stop offset="1" stop-color="#1a1f3a" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <!-- soft ground shadow -->
    <ellipse cx="100" cy="197" rx="47" ry="7" fill="url(#wfCatShadow)"/>
    <g class="lean">
    <g class="char-root">
      <!-- tapered curled tail (behind body) -->
      <path class="tail" d="M129.8,185.4L131.8,186.2L133.7,186.9L135.6,187.5L137.5,188.1L139.4,188.6L141.3,189L143.2,189.4L145,189.7L146.9,189.8L148.7,189.9L150.5,190L152.3,189.9L154,189.8L155.7,189.6L157.4,189.3L159,188.9L160.7,188.4L162.2,187.9L163.7,187.2L165.2,186.5L166.6,185.8L168,184.9L169.3,184L170.5,183L171.7,181.9L172.8,180.7L173.8,179.5L174.8,178.3L175.7,176.9L176.5,175.5L177.2,174.1L177.8,172.6L178.4,171L178.8,169.4L179.2,167.7L179.5,166L179.7,164.3L179.9,162.5L179.9,160.7L179.9,158.8L179.8,156.8L179.6,154.8L179.3,152.8L179,150.7L178.7,150L178.2,149.4L177.5,149.1L176.7,149L176,149.3L175.4,149.8L175.1,150.5L175,151.3L175.1,153.2L175.1,155.1L175.1,156.9L174.9,158.6L174.7,160.2L174.4,161.8L174.1,163.3L173.6,164.7L173.2,166L172.6,167.2L172.1,168.4L171.4,169.5L170.8,170.5L170,171.4L169.3,172.3L168.5,173L167.7,173.8L166.9,174.4L166,175L165.1,175.5L164.2,175.9L163.3,176.3L162.3,176.7L161.3,177L160.3,177.2L159.3,177.4L158.2,177.5L157.1,177.5L156,177.5L154.9,177.5L153.8,177.4L152.7,177.2L151.5,177L150.3,176.7L149.1,176.4L147.9,176L146.7,175.6L145.5,175L144.3,174.5L143,173.8L141.8,173.1L140.6,172.4L139.4,171.5L138.2,170.6Z"
            fill="url(#wfCatTail)" stroke="#242a4a" stroke-width="3" stroke-linejoin="round"
            style="transform-origin:134px 178px"/>
      <!-- body -->
      <path d="M100,122 C122,122 139,133 144,153 C148,169 145,184 137,191 C131,196 122,197 112,195 C106,194 104,192 100,192 C96,192 94,194 88,195 C78,197 69,196 63,191 C55,184 52,169 56,153 C61,133 78,122 100,122 Z"
            fill="url(#wfCatFur)" stroke="#242a4a" stroke-width="3.2" stroke-linejoin="round"/>
      <g clip-path="url(#wfCatBodyClip)">
        <path d="M136,140 C143,154 145,172 141,186" fill="none" stroke="#ffffff" stroke-width="2.6"
              stroke-linecap="round" opacity="0.4"/>
        <ellipse cx="74" cy="144" rx="14" ry="7" fill="#ffffff" opacity="0.22" transform="rotate(-18 74 144)"/>
        <ellipse cx="134" cy="176" rx="16" ry="20" fill="#6b76b8" opacity="0.16"/>
        <ellipse cx="100" cy="166" rx="26" ry="27" fill="url(#wfCatBelly)"/>
      </g>
      <!-- chest fluff bib -->
      <path d="M75,144 C77,157 86,167 100,168 C114,167 123,157 125,144 C117,152 109,155 100,155 C91,155 83,152 75,144 Z"
            fill="#f8faff" stroke="#242a4a" stroke-width="1.8" stroke-linejoin="round"/>
      <!-- shadow cast by the head onto the chest -->
      <ellipse cx="100" cy="148" rx="30" ry="9" fill="url(#wfCatChin)"/>
      <!-- front paws with toe beans -->
      <path d="M65,190.5 C64,181 70.5,175 79,175 C87.5,175 94,181 93,190.5 C93,194.5 88.5,196.5 79,196.5 C69.5,196.5 65,194.5 65,190.5 Z"
            fill="#f6f8ff" stroke="#242a4a" stroke-width="2.6" stroke-linejoin="round"/>
      <ellipse cx="79" cy="190.5" rx="6.2" ry="4" fill="#f2a3bd"/>
      <circle cx="72.5" cy="185" r="2.5" fill="#f2a3bd"/>
      <circle cx="79" cy="183.4" r="2.5" fill="#f2a3bd"/>
      <circle cx="85.5" cy="185" r="2.5" fill="#f2a3bd"/>
      <path d="M107,190.5 C106,181 112.5,175 121,175 C129.5,175 136,181 135,190.5 C135,194.5 130.5,196.5 121,196.5 C111.5,196.5 107,194.5 107,190.5 Z"
            fill="#f6f8ff" stroke="#242a4a" stroke-width="2.6" stroke-linejoin="round"/>
      <ellipse cx="121" cy="190.5" rx="6.2" ry="4" fill="#f2a3bd"/>
      <circle cx="114.5" cy="185" r="2.5" fill="#f2a3bd"/>
      <circle cx="121" cy="183.4" r="2.5" fill="#f2a3bd"/>
      <circle cx="127.5" cy="185" r="2.5" fill="#f2a3bd"/>
      <!-- head -->
      <g class="head" style="transform-origin:100px 140px">
        <g class="ear ear-l" style="transform-origin:74px 58px">
          <path d="M54,70 C50,55 46,39 47,29 C56,24 70,36 79,49 C83,54 86,57 86,56 C77,63 63,68 54,70 Z"
                fill="url(#wfCatFur)" stroke="#242a4a" stroke-width="3.2" stroke-linejoin="round"/>
          <path d="M59,62 C55,51 53,42 54,37 C61,34 71,43 77,51 C72,56 65,60 59,62 Z"
                fill="url(#wfCatInner)"/>
          <path d="M57,58 C54,49 53,44 54.5,40" fill="none" stroke="#ffffff" stroke-width="1.5"
                stroke-linecap="round" opacity="0.4"/>
        </g>
        <g class="ear ear-r" style="transform-origin:126px 58px">
          <path d="M146,70 C150,55 154,39 153,29 C144,24 130,36 121,49 C117,54 114,57 114,56 C123,63 137,68 146,70 Z"
                fill="url(#wfCatFur)" stroke="#242a4a" stroke-width="3.2" stroke-linejoin="round"/>
          <path d="M141,62 C145,51 147,42 146,37 C139,34 129,43 123,51 C128,56 135,60 141,62 Z"
                fill="url(#wfCatInner)"/>
          <path d="M143,58 C146,49 147,44 145.5,40" fill="none" stroke="#ffffff" stroke-width="1.5"
                stroke-linecap="round" opacity="0.4"/>
        </g>
        <!-- head silhouette -->
        <path d="M100,49 C118,49 134,54 143,66 C149,74 151,84 150,93 C149,101 146,107 143,111 C146,117 145,125 139,130 C133,136 119,141 100,141 C81,141 67,136 61,130 C55,125 54,117 57,111 C54,107 51,101 50,93 C49,84 51,74 57,66 C66,54 82,49 100,49 Z"
              fill="url(#wfCatFur)" stroke="#242a4a" stroke-width="3.2" stroke-linejoin="round"/>
        <!-- lighting: rim light + key gloss (clipped to the head) -->
        <g clip-path="url(#wfCatHeadClip)">
          <path d="M127,55 C139,63 146,75 148,90" fill="none" stroke="#ffffff" stroke-width="2.6"
                stroke-linecap="round" opacity="0.42"/>
          <ellipse cx="75" cy="63" rx="15" ry="6.5" fill="#ffffff" opacity="0.28" transform="rotate(-14 75 63)"/>
          <circle cx="94" cy="57" r="3.2" fill="#ffffff" opacity="0.45"/>
          <ellipse cx="100" cy="135" rx="30" ry="9" fill="url(#wfCatChin)"/>
        </g>
        <!-- tabby forehead marks -->
        <g fill="none" stroke="#8b99d6" stroke-width="4.5" stroke-linecap="round" opacity="0.5">
          <path d="M93,57 C95,63 95,69 93.5,74"/>
          <path d="M100,55 C100,62 100,69 100,75"/>
          <path d="M107,57 C105,63 105,69 106.5,74"/>
        </g>
        <!-- brows -->
        <g fill="none" stroke="#242a4a" stroke-width="2.2" stroke-linecap="round" opacity="0.5">
          <path d="M71,73.5 C75,70.5 81,70 85,72"/>
          <path d="M129,73.5 C125,70.5 119,70 115,72"/>
        </g>
        <!-- muzzle -->
        <path d="M84,116 C84,109 91,105.5 100,105.5 C109,105.5 116,109 116,116 C116,124 108,129.5 100,129.5 C92,129.5 84,124 84,116 Z"
              fill="url(#wfCatMuzzle)" stroke="#242a4a" stroke-width="1.5" stroke-opacity="0.4"/>
        <!-- left eye -->
        <g class="eye eye-l" style="transform-origin:80px 95px">
          <g clip-path="url(#wfEyeClipL)">
            <ellipse cx="80" cy="95" rx="15" ry="15" fill="url(#wfCatSclera)"/>
            <ellipse cx="80" cy="86" rx="14.5" ry="9" fill="#c9d1f2" opacity="0.55"/>
            <g class="pupil pupil-l">
              <circle cx="80" cy="96" r="13" fill="url(#wfCatIris)"/>
              <circle cx="80" cy="96" r="13" fill="none" stroke="#7a4a14" stroke-width="2.4" opacity="0.5"/>
              <ellipse cx="80" cy="102" rx="8.5" ry="5" fill="#ffeda8" opacity="0.75"/>
              <circle cx="80" cy="96" r="6.4" fill="#1a1633"/>
              <ellipse cx="74.6" cy="90.2" rx="4.4" ry="3.8" fill="#ffffff" opacity="0.97"/>
              <circle cx="86" cy="102.5" r="2.4" fill="#ffffff" opacity="0.85"/>
              <circle cx="84" cy="90" r="1.3" fill="#ffffff" opacity="0.9"/>
            </g>
            <ellipse cx="80" cy="106.5" rx="7.5" ry="2.6" fill="#ffffff" opacity="0.55"/>
            <path d="M66.5,86.5 C71,80.5 89,80.5 93.5,86.5" fill="none" stroke="#242a4a"
                  stroke-width="3.4" stroke-linecap="round"/>
            <rect class="lid lid-l" x="64" y="50" width="32" height="30" fill="url(#wfCatFur)"/>
            <path class="lid-arc lid-arc-l" d="M67,104 Q80,113.5 93,104" fill="none"
                  stroke="#242a4a" stroke-width="2.5" stroke-linecap="round" opacity="0"/>
          </g>
          <ellipse cx="80" cy="95" rx="15" ry="15" fill="none" stroke="#242a4a" stroke-width="2.6"/>
        </g>
        <!-- right eye -->
        <g class="eye eye-r" style="transform-origin:120px 95px">
          <g clip-path="url(#wfEyeClipR)">
            <ellipse cx="120" cy="95" rx="15" ry="15" fill="url(#wfCatSclera)"/>
            <ellipse cx="120" cy="86" rx="14.5" ry="9" fill="#c9d1f2" opacity="0.55"/>
            <g class="pupil pupil-r">
              <circle cx="120" cy="96" r="13" fill="url(#wfCatIris)"/>
              <circle cx="120" cy="96" r="13" fill="none" stroke="#7a4a14" stroke-width="2.4" opacity="0.5"/>
              <ellipse cx="120" cy="102" rx="8.5" ry="5" fill="#ffeda8" opacity="0.75"/>
              <circle cx="120" cy="96" r="6.4" fill="#1a1633"/>
              <ellipse cx="114.6" cy="90.2" rx="4.4" ry="3.8" fill="#ffffff" opacity="0.97"/>
              <circle cx="126" cy="102.5" r="2.4" fill="#ffffff" opacity="0.85"/>
              <circle cx="124" cy="90" r="1.3" fill="#ffffff" opacity="0.9"/>
            </g>
            <ellipse cx="120" cy="106.5" rx="7.5" ry="2.6" fill="#ffffff" opacity="0.55"/>
            <path d="M106.5,86.5 C111,80.5 129,80.5 133.5,86.5" fill="none" stroke="#242a4a"
                  stroke-width="3.4" stroke-linecap="round"/>
            <rect class="lid lid-r" x="104" y="50" width="32" height="30" fill="url(#wfCatFur)"/>
            <path class="lid-arc lid-arc-r" d="M107,104 Q120,113.5 133,104" fill="none"
                  stroke="#242a4a" stroke-width="2.5" stroke-linecap="round" opacity="0"/>
          </g>
          <ellipse cx="120" cy="95" rx="15" ry="15" fill="none" stroke="#242a4a" stroke-width="2.6"/>
        </g>
        <!-- nose + mouth -->
        <path d="M95,109.5 C97,107.8 103,107.8 105,109.5 C105,113.5 102.5,116.5 100,118 C97.5,116.5 95,113.5 95,109.5 Z"
              fill="url(#wfCatNose)" stroke="#242a4a" stroke-width="2" stroke-linejoin="round"/>
        <ellipse cx="97.6" cy="110.3" rx="2" ry="1.4" fill="#ffffff" opacity="0.8"
                 transform="rotate(-15 97.6 110.3)"/>
        <path class="mouth-normal" d="M100,118 L100,122.5 M93,123 C95,128 98.5,128 100,123.5 C101.5,128 105,128 107,123"
              fill="none" stroke="#242a4a" stroke-width="2.4" stroke-linecap="round"/>
        <g class="mouth-yawn" opacity="0">
          <ellipse class="yawn-oral" cx="100" cy="124" rx="9" ry="1" fill="#59233a"/>
          <ellipse class="tongue" cx="100" cy="130" rx="5" ry="1" fill="#ef8fae"/>
        </g>
        <!-- blush + whiskers -->
        <ellipse class="blush" cx="58" cy="116" rx="10" ry="6" fill="url(#wfCatBlush)"/>
        <ellipse class="blush" cx="142" cy="116" rx="10" ry="6" fill="url(#wfCatBlush)"/>
        <g fill="none" stroke="#242a4a" stroke-width="1.5" stroke-linecap="round" opacity="0.5">
          <path d="M63,110 C51,106 39,104 28,105"/>
          <path d="M62,116 C50,116 38,118 27,121"/>
          <path d="M63,122 C52,125 43,130 35,136"/>
          <path d="M137,110 C149,106 161,104 172,105"/>
          <path d="M138,116 C150,116 162,118 173,121"/>
          <path d="M137,122 C148,125 157,130 165,136"/>
        </g>
      </g>
      <!-- Zzz -->
      <g class="zzz" font-family="Segoe UI, sans-serif" font-weight="700" fill="#dfe4ff">
        <text x="152" y="44" font-size="16">Z</text>
        <text x="166" y="30" font-size="12">Z</text>
        <text x="176" y="19" font-size="9">Z</text>
      </g>
    </g>
    </g>
  </svg>`;

  const DOG_SVG = `
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
       style="--breathe-dur:3.6s;--sleep-breathe:5.4s;--tail-dur:2.6s">
    <defs>
      <clipPath id="wfEyeClipL"><ellipse cx="80" cy="95" rx="15" ry="15"/></clipPath>
      <clipPath id="wfEyeClipR"><ellipse cx="120" cy="95" rx="15" ry="15"/></clipPath>
      <clipPath id="wfDogHeadClip"><path d="M100,50 C122,50 139,57 146,72 C151,83 151,95 148,105 C146,114 142,122 136,128 C128,136 115,141 100,141 C85,141 72,136 64,128 C58,122 54,114 52,105 C49,95 49,83 54,72 C61,57 78,50 100,50 Z"/></clipPath>
      <clipPath id="wfDogBodyClip"><path d="M100,123 C123,123 141,135 145,155 C148,171 145,185 137,191 C131,196 121,197 111,195 C105,194 104,193 100,193 C96,193 95,194 89,195 C79,197 69,196 63,191 C55,185 52,171 55,155 C59,135 77,123 100,123 Z"/></clipPath>
      <linearGradient id="wfDogFur" gradientUnits="userSpaceOnUse" x1="36" y1="30" x2="166" y2="196">
        <stop offset="0" stop-color="#fff1d8"/>
        <stop offset="0.5" stop-color="#f7d7a4"/>
        <stop offset="1" stop-color="#dda869"/>
      </linearGradient>
      <linearGradient id="wfDogTail" gradientUnits="userSpaceOnUse" x1="137" y1="176" x2="169" y2="144">
        <stop offset="0" stop-color="#d9a05f"/>
        <stop offset="0.55" stop-color="#f0cd97"/>
        <stop offset="1" stop-color="#fdf0d8"/>
      </linearGradient>
      <linearGradient id="wfDogSclera" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.72" stop-color="#fffbf4"/>
        <stop offset="1" stop-color="#f6ecdd"/>
      </linearGradient>
      <linearGradient id="wfDogIris" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f2d3a0"/>
        <stop offset="0.5" stop-color="#b57c40"/>
        <stop offset="1" stop-color="#6d421d"/>
      </linearGradient>
      <linearGradient id="wfDogNose" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#4a3d52"/>
        <stop offset="1" stop-color="#241d2b"/>
      </linearGradient>
      <radialGradient id="wfDogBelly">
        <stop offset="0" stop-color="#fffaf0" stop-opacity="0.95"/>
        <stop offset="0.7" stop-color="#faeccc" stop-opacity="0.85"/>
        <stop offset="1" stop-color="#faeccc" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="wfDogMuzzle">
        <stop offset="0" stop-color="#fffdf8"/>
        <stop offset="0.7" stop-color="#fcf1dd"/>
        <stop offset="1" stop-color="#f9ebd2"/>
      </radialGradient>
      <radialGradient id="wfDogChin">
        <stop offset="0" stop-color="#7a5426" stop-opacity="0.30"/>
        <stop offset="1" stop-color="#7a5426" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="wfDogBlush">
        <stop offset="0" stop-color="#f78bb0" stop-opacity="0.6"/>
        <stop offset="0.55" stop-color="#f4a0c0" stop-opacity="0.34"/>
        <stop offset="1" stop-color="#f0a8c0" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="wfDogShadow">
        <stop offset="0" stop-color="#241a12" stop-opacity="0.42"/>
        <stop offset="1" stop-color="#241a12" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <!-- soft ground shadow -->
    <ellipse cx="100" cy="197" rx="48" ry="7" fill="url(#wfDogShadow)"/>
    <g class="lean">
    <g class="char-root">
      <!-- tapered curled tail (behind body) — faster wag than the cat -->
      <path class="tail" d="M133.5,181.9L135.6,182.6L137.6,183.3L139.6,183.8L141.6,184.2L143.6,184.5L145.5,184.7L147.5,184.9L149.3,184.9L151.2,184.8L153,184.6L154.8,184.3L156.5,183.9L158.2,183.4L159.8,182.8L161.3,182.2L162.8,181.4L164.3,180.6L165.6,179.7L166.9,178.7L168.2,177.7L169.3,176.6L170.4,175.4L171.4,174.1L172.3,172.8L173.1,171.5L173.8,170.1L174.5,168.6L175,167.2L175.5,165.6L175.8,164.1L176.1,162.5L176.2,160.9L176.3,159.2L176.3,157.6L176.2,155.9L176,154.2L175.6,152.5L175.2,150.8L174.7,149L174.1,147.3L173.3,145.5L172.5,143.7L171.6,142L170.5,140.2L170.1,139.6L169.5,139.3L168.8,139.3L168.2,139.5L167.6,139.9L167.3,140.5L167.3,141.2L167.5,141.8L168.2,143.6L168.9,145.3L169.4,147L169.8,148.6L170.2,150.2L170.4,151.7L170.5,153.2L170.6,154.7L170.6,156.1L170.4,157.4L170.2,158.7L170,159.9L169.6,161.1L169.2,162.2L168.8,163.3L168.3,164.3L167.7,165.3L167.1,166.1L166.4,167L165.7,167.7L164.9,168.5L164.1,169.1L163.3,169.7L162.4,170.3L161.5,170.8L160.6,171.2L159.7,171.6L158.7,171.9L157.7,172.1L156.6,172.3L155.6,172.5L154.5,172.5L153.4,172.5L152.3,172.5L151.2,172.4L150,172.2L148.9,171.9L147.7,171.6L146.5,171.2L145.3,170.8L144.1,170.2L142.9,169.6L141.7,168.9L140.5,168.1Z"
            fill="url(#wfDogTail)" stroke="#242a4a" stroke-width="3" stroke-linejoin="round"
            style="transform-origin:137px 175px"/>
      <!-- body -->
      <path d="M100,123 C123,123 141,135 145,155 C148,171 145,185 137,191 C131,196 121,197 111,195 C105,194 104,193 100,193 C96,193 95,194 89,195 C79,197 69,196 63,191 C55,185 52,171 55,155 C59,135 77,123 100,123 Z"
            fill="url(#wfDogFur)" stroke="#242a4a" stroke-width="3.2" stroke-linejoin="round"/>
      <g clip-path="url(#wfDogBodyClip)">
        <path d="M136,142 C143,156 145,173 141,187" fill="none" stroke="#ffffff" stroke-width="2.6"
              stroke-linecap="round" opacity="0.4"/>
        <ellipse cx="74" cy="145" rx="14" ry="7" fill="#ffffff" opacity="0.22" transform="rotate(-18 74 145)"/>
        <ellipse cx="134" cy="177" rx="16" ry="20" fill="#b57c40" opacity="0.16"/>
        <ellipse cx="100" cy="168" rx="26" ry="24" fill="url(#wfDogBelly)"/>
      </g>
      <!-- cream chest bib -->
      <path d="M69,146 C73,160 81,170 91,175 C88,181 94,184.5 100,185.5 C106,184.5 112,181 109,175 C119,170 127,160 131,146 C122,153 112,156 100,156 C88,156 78,153 69,146 Z"
            fill="#fffaf0" stroke="#242a4a" stroke-width="1.8" stroke-linejoin="round"/>
      <!-- shadow cast by the head onto the chest -->
      <ellipse cx="100" cy="149" rx="30" ry="9" fill="url(#wfDogChin)"/>
      <!-- front paws with toe beans -->
      <path d="M65,190.5 C64,181 70.5,175 79,175 C87.5,175 94,181 93,190.5 C93,194.5 88.5,196.5 79,196.5 C69.5,196.5 65,194.5 65,190.5 Z"
            fill="#fdf3e2" stroke="#242a4a" stroke-width="2.6" stroke-linejoin="round"/>
      <ellipse cx="79" cy="190.5" rx="6.2" ry="4" fill="#f2a3bd"/>
      <circle cx="72.5" cy="185" r="2.5" fill="#f2a3bd"/>
      <circle cx="79" cy="183.4" r="2.5" fill="#f2a3bd"/>
      <circle cx="85.5" cy="185" r="2.5" fill="#f2a3bd"/>
      <path d="M107,190.5 C106,181 112.5,175 121,175 C129.5,175 136,181 135,190.5 C135,194.5 130.5,196.5 121,196.5 C111.5,196.5 107,194.5 107,190.5 Z"
            fill="#fdf3e2" stroke="#242a4a" stroke-width="2.6" stroke-linejoin="round"/>
      <ellipse cx="121" cy="190.5" rx="6.2" ry="4" fill="#f2a3bd"/>
      <circle cx="114.5" cy="185" r="2.5" fill="#f2a3bd"/>
      <circle cx="121" cy="183.4" r="2.5" fill="#f2a3bd"/>
      <circle cx="127.5" cy="185" r="2.5" fill="#f2a3bd"/>
      <!-- head -->
      <g class="head" style="transform-origin:100px 140px">
        <!-- floppy ears -->
        <g class="ear ear-l" style="transform-origin:66px 56px">
          <path d="M64,50 C44,51 30,64 26,84 C22,104 28,122 42,128 C54,133 66,126 69,111 C72,94 69,66 64,50 Z"
                fill="url(#wfDogFur)" stroke="#242a4a" stroke-width="3.2" stroke-linejoin="round"/>
          <path d="M52,62 C40,72 35,90 38,107 C41,118 49,124 56,120 C48,105 46,80 52,62 Z"
                fill="#e6b075" opacity="0.55"/>
          <ellipse cx="47" cy="86" rx="5.5" ry="13" fill="#ffffff" opacity="0.22" transform="rotate(10 47 86)"/>
        </g>
        <g class="ear ear-r" style="transform-origin:134px 56px">
          <path d="M136,50 C156,51 170,64 174,84 C178,104 172,122 158,128 C146,133 134,126 131,111 C128,94 131,66 136,50 Z"
                fill="url(#wfDogFur)" stroke="#242a4a" stroke-width="3.2" stroke-linejoin="round"/>
          <!-- caramel patch for personality -->
          <path d="M148,58 C159,70 164,90 160,108 C157,120 149,126 144,121 C151,105 153,78 148,58 Z"
                fill="#d9a05f" opacity="0.8"/>
          <ellipse cx="153" cy="86" rx="5.5" ry="13" fill="#ffffff" opacity="0.2" transform="rotate(-10 153 86)"/>
        </g>
        <!-- head silhouette -->
        <path d="M100,50 C122,50 139,57 146,72 C151,83 151,95 148,105 C146,114 142,122 136,128 C128,136 115,141 100,141 C85,141 72,136 64,128 C58,122 54,114 52,105 C49,95 49,83 54,72 C61,57 78,50 100,50 Z"
              fill="url(#wfDogFur)" stroke="#242a4a" stroke-width="3.2" stroke-linejoin="round"/>
        <!-- lighting: rim light + key gloss (clipped to the head) -->
        <g clip-path="url(#wfDogHeadClip)">
          <path d="M127,56 C139,64 146,76 148,91" fill="none" stroke="#ffffff" stroke-width="2.6"
                stroke-linecap="round" opacity="0.42"/>
          <ellipse cx="76" cy="64" rx="15" ry="6.5" fill="#ffffff" opacity="0.26" transform="rotate(-14 76 64)"/>
          <circle cx="94" cy="58" r="3.2" fill="#ffffff" stroke="none" opacity="0.42"/>
          <ellipse cx="100" cy="135" rx="29" ry="9" fill="url(#wfDogChin)"/>
        </g>
        <!-- cream blaze -->
        <path d="M91,55 C93,64 95,71 96.5,78 L103.5,78 C105,71 107,64 109,55 C104,57.5 96,57.5 91,55 Z"
              fill="#fff6e6" opacity="0.9"/>
        <!-- eyebrow spots -->
        <ellipse cx="74" cy="73.5" rx="5" ry="3.4" fill="#fff6e6" opacity="0.95" transform="rotate(-8 74 73.5)"/>
        <ellipse cx="126" cy="73.5" rx="5" ry="3.4" fill="#fff6e6" opacity="0.95" transform="rotate(8 126 73.5)"/>
        <!-- muzzle -->
        <path d="M74,119 C74,108.5 85,103 100,103 C115,103 126,108.5 126,119 C126,131 114,138 100,138 C86,138 74,131 74,119 Z"
              fill="url(#wfDogMuzzle)" stroke="#242a4a" stroke-width="1.6" stroke-opacity="0.45"/>
        <!-- left eye -->
        <g class="eye eye-l" style="transform-origin:80px 95px">
          <g clip-path="url(#wfEyeClipL)">
            <ellipse cx="80" cy="95" rx="15" ry="15" fill="url(#wfDogSclera)"/>
            <ellipse cx="80" cy="86" rx="14.5" ry="9" fill="#ecd7b6" opacity="0.55"/>
            <g class="pupil pupil-l">
              <circle cx="80" cy="96" r="13" fill="url(#wfDogIris)"/>
              <circle cx="80" cy="96" r="13" fill="none" stroke="#6b431f" stroke-width="2.4" opacity="0.55"/>
              <ellipse cx="80" cy="102" rx="8.5" ry="5" fill="#ffe9c4" opacity="0.7"/>
              <circle cx="80" cy="96" r="6.4" fill="#20182a"/>
              <ellipse cx="74.6" cy="90.2" rx="4.4" ry="3.8" fill="#ffffff" opacity="0.97"/>
              <circle cx="86" cy="102.5" r="2.4" fill="#ffffff" opacity="0.85"/>
              <circle cx="84" cy="90" r="1.3" fill="#ffffff" opacity="0.9"/>
            </g>
            <ellipse cx="80" cy="106.5" rx="7.5" ry="2.6" fill="#ffffff" opacity="0.55"/>
            <path d="M66.5,86.5 C71,80.5 89,80.5 93.5,86.5" fill="none" stroke="#242a4a"
                  stroke-width="3.4" stroke-linecap="round"/>
            <rect class="lid lid-l" x="64" y="50" width="32" height="30" fill="url(#wfDogFur)"/>
            <path class="lid-arc lid-arc-l" d="M67,104 Q80,113.5 93,104" fill="none"
                  stroke="#242a4a" stroke-width="2.5" stroke-linecap="round" opacity="0"/>
          </g>
          <ellipse cx="80" cy="95" rx="15" ry="15" fill="none" stroke="#242a4a" stroke-width="2.6"/>
        </g>
        <!-- right eye -->
        <g class="eye eye-r" style="transform-origin:120px 95px">
          <g clip-path="url(#wfEyeClipR)">
            <ellipse cx="120" cy="95" rx="15" ry="15" fill="url(#wfDogSclera)"/>
            <ellipse cx="120" cy="86" rx="14.5" ry="9" fill="#ecd7b6" opacity="0.55"/>
            <g class="pupil pupil-r">
              <circle cx="120" cy="96" r="13" fill="url(#wfDogIris)"/>
              <circle cx="120" cy="96" r="13" fill="none" stroke="#6b431f" stroke-width="2.4" opacity="0.55"/>
              <ellipse cx="120" cy="102" rx="8.5" ry="5" fill="#ffe9c4" opacity="0.7"/>
              <circle cx="120" cy="96" r="6.4" fill="#20182a"/>
              <ellipse cx="114.6" cy="90.2" rx="4.4" ry="3.8" fill="#ffffff" opacity="0.97"/>
              <circle cx="126" cy="102.5" r="2.4" fill="#ffffff" opacity="0.85"/>
              <circle cx="124" cy="90" r="1.3" fill="#ffffff" opacity="0.9"/>
            </g>
            <ellipse cx="120" cy="106.5" rx="7.5" ry="2.6" fill="#ffffff" opacity="0.55"/>
            <path d="M106.5,86.5 C111,80.5 129,80.5 133.5,86.5" fill="none" stroke="#242a4a"
                  stroke-width="3.4" stroke-linecap="round"/>
            <rect class="lid lid-r" x="104" y="50" width="32" height="30" fill="url(#wfDogFur)"/>
            <path class="lid-arc lid-arc-r" d="M107,104 Q120,113.5 133,104" fill="none"
                  stroke="#242a4a" stroke-width="2.5" stroke-linecap="round" opacity="0"/>
          </g>
          <ellipse cx="120" cy="95" rx="15" ry="15" fill="none" stroke="#242a4a" stroke-width="2.6"/>
        </g>
        <!-- nose + mouth -->
        <path d="M89,108.5 C90.5,103.5 95,101 100,101 C105,101 109.5,103.5 111,108.5 C111.5,114 106,119.5 100,119.5 C94,119.5 88.5,114 89,108.5 Z"
              fill="url(#wfDogNose)" stroke="#242a4a" stroke-width="2" stroke-linejoin="round"/>
        <ellipse cx="95.5" cy="105" rx="3.6" ry="2.2" fill="#ffffff" opacity="0.4"
                 transform="rotate(-14 95.5 105)"/>
        <path class="mouth-normal" d="M100,119.5 L100,125 M91.5,125 C94,131 98.5,131.5 100,126 C101.5,131.5 106,131 108.5,125"
              fill="none" stroke="#242a4a" stroke-width="2.4" stroke-linecap="round"/>
        <g class="mouth-yawn" opacity="0">
          <ellipse class="yawn-oral" cx="100" cy="129" rx="9" ry="1" fill="#59233a"/>
          <ellipse class="tongue" cx="100" cy="135" rx="5" ry="1" fill="#ef8fae"/>
        </g>
        <!-- muzzle whisker dots -->
        <g fill="#c9a06f" opacity="0.7">
          <circle cx="83" cy="124" r="1.2"/><circle cx="87.5" cy="128.5" r="1.2"/><circle cx="79" cy="129.5" r="1.2"/>
          <circle cx="117" cy="124" r="1.2"/><circle cx="112.5" cy="128.5" r="1.2"/><circle cx="121" cy="129.5" r="1.2"/>
        </g>
        <!-- blush -->
        <ellipse class="blush" cx="57" cy="116" rx="10" ry="6" fill="url(#wfDogBlush)"/>
        <ellipse class="blush" cx="143" cy="116" rx="10" ry="6" fill="url(#wfDogBlush)"/>
      </g>
      <!-- Zzz -->
      <g class="zzz" font-family="Segoe UI, sans-serif" font-weight="700" fill="#fdf3e3">
        <text x="152" y="44" font-size="16">Z</text>
        <text x="166" y="30" font-size="12">Z</text>
        <text x="176" y="19" font-size="9">Z</text>
      </g>
    </g>
    </g>
  </svg>`;

  const BLOB_SVG = `
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg"
       style="--breathe-dur:4.4s;--sleep-breathe:6.4s;--tail-dur:5s">
    <defs>
      <clipPath id="wfEyeClipL"><ellipse cx="78" cy="100" rx="19" ry="17"/></clipPath>
      <clipPath id="wfEyeClipR"><ellipse cx="122" cy="100" rx="19" ry="17"/></clipPath>
      <clipPath id="wfBlobBodyClip"><path d="M34,167 C34,112 54,58 92,45 C101,42 110,43 115,49 C137,62 166,110 166,167 C164,174 158,178 150,177 C140,176 132,177 124,178 C114,179 104,177 94,177 C84,177 74,178 64,177 C54,176 44,176 38,173 C35,171 34,169 34,167 Z"/></clipPath>
      <linearGradient id="wfBlobBody" gradientUnits="userSpaceOnUse" x1="36" y1="34" x2="164" y2="184">
        <stop offset="0" stop-color="#e6fff7"/>
        <stop offset="0.45" stop-color="#abf3db"/>
        <stop offset="1" stop-color="#66d4b6"/>
      </linearGradient>
      <linearGradient id="wfBlobCream" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#fffdf3" stop-opacity="0"/>
        <stop offset="0.4" stop-color="#fffdf3" stop-opacity="0.9"/>
        <stop offset="1" stop-color="#fdf4e0" stop-opacity="0.95"/>
      </linearGradient>
      <linearGradient id="wfBlobSclera" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="0.72" stop-color="#f4fffb"/>
        <stop offset="1" stop-color="#e4f7f1"/>
      </linearGradient>
      <linearGradient id="wfBlobIris" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#a7f5dd"/>
        <stop offset="0.5" stop-color="#3ec4a4"/>
        <stop offset="1" stop-color="#14776a"/>
      </linearGradient>
      <radialGradient id="wfBlobGlow">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="wfBlobBlush">
        <stop offset="0" stop-color="#f78bb0" stop-opacity="0.62"/>
        <stop offset="0.55" stop-color="#f4a0c0" stop-opacity="0.34"/>
        <stop offset="1" stop-color="#f0a8c0" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="wfBlobShadow">
        <stop offset="0" stop-color="#123028" stop-opacity="0.42"/>
        <stop offset="1" stop-color="#123028" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <!-- soft ground shadow -->
    <ellipse cx="100" cy="181" rx="54" ry="7" fill="url(#wfBlobShadow)"/>
    <g class="lean">
    <g class="char-root">
      <!-- head == whole body for a blob; tilts around its base -->
      <g class="head" style="transform-origin:100px 176px">
        <!-- smooth jelly dome: soft curled peak, gentle puddle base -->
        <path d="M34,167 C34,112 54,58 92,45 C101,42 110,43 115,49 C137,62 166,110 166,167 C164,174 158,178 150,177 C140,176 132,177 124,178 C114,179 104,177 94,177 C84,177 74,178 64,177 C54,176 44,176 38,173 C35,171 34,169 34,167 Z"
              fill="url(#wfBlobBody)" stroke="#242a4a" stroke-width="3" stroke-linejoin="round"/>
        <g clip-path="url(#wfBlobBodyClip)">
          <!-- settled cream underside -->
          <path d="M34,144 C54,154 78,158 100,158 C122,158 146,154 166,144 L166,184 L34,184 Z"
                fill="url(#wfBlobCream)"/>
          <ellipse cx="92" cy="80" rx="42" ry="32" fill="url(#wfBlobGlow)"/>
          <!-- key gloss + specular -->
          <path d="M56,86 C60,66 71,52 89,46 C75,55 66,69 63,91 C59,90 57,88 56,86 Z"
                fill="#ffffff" opacity="0.55"/>
          <circle cx="95" cy="54" r="4.5" fill="#ffffff" opacity="0.8"/>
          <!-- inner rim light -->
          <path d="M147,104 C153,126 152,147 147,162" fill="none" stroke="#ffffff" stroke-width="3.5"
                stroke-linecap="round" opacity="0.35"/>
          <!-- suspended bubbles -->
          <circle cx="131" cy="76" r="4" fill="#ffffff" fill-opacity="0.16" stroke="#ffffff" stroke-opacity="0.5" stroke-width="1.3"/>
          <circle cx="60" cy="116" r="3" fill="#ffffff" fill-opacity="0.16" stroke="#ffffff" stroke-opacity="0.45" stroke-width="1.2"/>
        </g>
        <!-- little jelly droplet squeezed out at the base -->
        <ellipse cx="29" cy="175" rx="5.5" ry="4.6" fill="url(#wfBlobBody)" stroke="#242a4a" stroke-width="2.4"/>
        <!-- rounded jelly ears (no horns) -->
        <g class="ear ear-l" style="transform-origin:70px 58px">
          <path d="M64,60 C57,51 55,37 63,31 C72,25 83,31 85,43 C86,51 82,58 76,61 C72,63 67,63 64,60 Z"
                fill="url(#wfBlobBody)" stroke="#242a4a" stroke-width="3" stroke-linejoin="round"/>
          <path d="M65,56 C61,49 60,40 65,36 C71,32 78,37 79,45 C80,51 77,55 73,57 C70,58 67,58 65,56 Z"
                fill="#f3fffb" opacity="0.9"/>
        </g>
        <g class="ear ear-r" style="transform-origin:130px 58px">
          <path d="M136,60 C143,51 145,37 137,31 C128,25 117,31 115,43 C114,51 118,58 124,61 C128,63 133,63 136,60 Z"
                fill="url(#wfBlobBody)" stroke="#242a4a" stroke-width="3" stroke-linejoin="round"/>
          <path d="M135,56 C139,49 140,40 135,36 C129,32 122,37 121,45 C120,51 123,55 127,57 C130,58 133,58 135,56 Z"
                fill="#f3fffb" opacity="0.9"/>
        </g>
        <!-- left eye (big kawaii) -->
        <g class="eye eye-l" style="transform-origin:78px 100px">
          <g clip-path="url(#wfEyeClipL)">
            <ellipse cx="78" cy="100" rx="19" ry="17" fill="url(#wfBlobSclera)"/>
            <ellipse cx="78" cy="90" rx="18.5" ry="10" fill="#c9f6ec" opacity="0.55"/>
            <g class="pupil pupil-l">
              <circle cx="78" cy="101" r="12" fill="url(#wfBlobIris)"/>
              <circle cx="78" cy="101" r="12" fill="none" stroke="#0f5548" stroke-width="2.6" opacity="0.6"/>
              <ellipse cx="78" cy="106.5" rx="8" ry="4.5" fill="#9ff0d8" opacity="0.6"/>
              <circle cx="78" cy="101" r="7" fill="#0c332c"/>
              <ellipse cx="72.5" cy="94.5" rx="5" ry="4.4" fill="#ffffff" opacity="0.97"/>
              <circle cx="85.5" cy="108" r="2.8" fill="#ffffff" opacity="0.85"/>
              <circle cx="83" cy="95" r="1.5" fill="#ffffff" opacity="0.9"/>
            </g>
            <ellipse cx="78" cy="113" rx="8" ry="3" fill="#ffffff" opacity="0.5"/>
            <path d="M60,93 C66,84 90,84 96,93" fill="none" stroke="#242a4a"
                  stroke-width="3.6" stroke-linecap="round"/>
            <rect class="lid lid-l" x="58" y="49" width="40" height="34" fill="url(#wfBlobBody)"/>
            <path class="lid-arc lid-arc-l" d="M61,109 Q78,119.5 95,109" fill="none"
                  stroke="#242a4a" stroke-width="3" stroke-linecap="round" opacity="0"/>
          </g>
          <ellipse cx="78" cy="100" rx="19" ry="17" fill="none" stroke="#242a4a" stroke-width="3"/>
        </g>
        <!-- right eye (big kawaii) -->
        <g class="eye eye-r" style="transform-origin:122px 100px">
          <g clip-path="url(#wfEyeClipR)">
            <ellipse cx="122" cy="100" rx="19" ry="17" fill="url(#wfBlobSclera)"/>
            <ellipse cx="122" cy="90" rx="18.5" ry="10" fill="#c9f6ec" opacity="0.55"/>
            <g class="pupil pupil-r">
              <circle cx="122" cy="101" r="12" fill="url(#wfBlobIris)"/>
              <circle cx="122" cy="101" r="12" fill="none" stroke="#0f5548" stroke-width="2.6" opacity="0.6"/>
              <ellipse cx="122" cy="106.5" rx="8" ry="4.5" fill="#9ff0d8" opacity="0.6"/>
              <circle cx="122" cy="101" r="7" fill="#0c332c"/>
              <ellipse cx="116.5" cy="94.5" rx="5" ry="4.4" fill="#ffffff" opacity="0.97"/>
              <circle cx="129.5" cy="108" r="2.8" fill="#ffffff" opacity="0.85"/>
              <circle cx="127" cy="95" r="1.5" fill="#ffffff" opacity="0.9"/>
            </g>
            <ellipse cx="122" cy="113" rx="8" ry="3" fill="#ffffff" opacity="0.5"/>
            <path d="M104,93 C110,84 134,84 140,93" fill="none" stroke="#242a4a"
                  stroke-width="3.6" stroke-linecap="round"/>
            <rect class="lid lid-r" x="102" y="49" width="40" height="34" fill="url(#wfBlobBody)"/>
            <path class="lid-arc lid-arc-r" d="M105,109 Q122,119.5 139,109" fill="none"
                  stroke="#242a4a" stroke-width="3" stroke-linecap="round" opacity="0"/>
          </g>
          <ellipse cx="122" cy="100" rx="19" ry="17" fill="none" stroke="#242a4a" stroke-width="3"/>
        </g>
        <!-- omega cat-mouth -->
        <path class="mouth-normal" d="M91,131 C94,137.5 98.5,137.5 100,132.5 C101.5,137.5 106,137.5 109,131"
              fill="none" stroke="#242a4a" stroke-width="3.2" stroke-linecap="round"/>
        <g class="mouth-yawn" opacity="0">
          <ellipse class="yawn-oral" cx="100" cy="136" rx="9" ry="1" fill="#17423d"/>
          <ellipse class="tongue" cx="100" cy="142" rx="5" ry="1" fill="#ef8fae"/>
        </g>
        <!-- cheeks -->
        <ellipse class="blush" cx="54" cy="126" rx="9.5" ry="7" fill="url(#wfBlobBlush)"/>
        <ellipse class="blush" cx="146" cy="126" rx="9.5" ry="7" fill="url(#wfBlobBlush)"/>
      </g>
      <!-- Zzz -->
      <g class="zzz" font-family="Segoe UI, sans-serif" font-weight="700" fill="#f0fffb">
        <text x="152" y="44" font-size="16">Z</text>
        <text x="166" y="30" font-size="12">Z</text>
        <text x="176" y="19" font-size="9">Z</text>
      </g>
    </g>
    </g>
  </svg>`;

  const ANIMS = {
    click:     { anim: 'a-hop' },
    pet:       { anim: 'a-pet', wide: true },
    boop:      { anim: 'a-shake', startle: true },
    right:     { anim: 'a-shake', startle: true },
    volumeUp:  { anim: 'a-dance', wide: true },
    volumeDown:{ wince: true },
    wallpaper: { anim: 'a-stretch', wide: true },
    notice:    { tilt: true },
  };

  // emoji shown when a reaction fires (pet hearts are spawned by startPet)
  const EMOJI = {
    boop: '❕', volumeUp: '🎵', volumeDown: '💦',
    wallpaper: '✨', notice: '💡',
  };

  const CHARS = {
    cat: {
      svg: CAT_SVG,
      lidTravel: 30,
      pupilAmp: [5.5, 4.5],
      idlePool: ['stretch', 'shake', 'look', 'yawn', 'earflick', 'wag', 'wiggle', 'look', 'hop'],
      reactions: ANIMS,
    },
    dog: {
      svg: DOG_SVG,
      lidTravel: 30,
      pupilAmp: [5.5, 4.5],
      idlePool: ['stretch', 'shake', 'look', 'yawn', 'wag', 'wiggle', 'hop', 'look', 'stretch'],
      reactions: ANIMS,
    },
    blob: {
      svg: BLOB_SVG,
      lidTravel: 34,
      pupilAmp: [7, 5.5],
      idlePool: ['jiggle', 'shake', 'look', 'yawn', 'wiggle', 'dance', 'hop', 'look'],
      reactions: {
        ...ANIMS,
        wallpaper: { anim: 'a-jiggle', wide: true },
      },
    },
  };

  const ANIM_CLASSES = ['a-enter', 'a-hop', 'a-shake', 'a-stretch', 'a-dance', 'a-jiggle', 'a-wag', 'a-pet'];
  const ANIM_DUR = { 'a-enter': 950, 'a-hop': 700, 'a-shake': 800, 'a-stretch': 1600, 'a-dance': 1900, 'a-jiggle': 1400, 'a-wag': 550, 'a-pet': 900 };

  const COOLDOWN = { click: 900, right: 1500, pet: 350, boop: 1300, volumeUp: 1600, volumeDown: 1600, wallpaper: 2600, notice: 3200 };

  const CORNERS = {
    'top-left': [-1, -1], 'top-center': [0, -1], 'top-right': [1, -1],
    'middle-left': [-1, 0], 'center': [0, 0], 'middle-right': [1, 0],
    'bottom-left': [-1, 1], 'bottom-center': [0, 1], 'bottom-right': [1, 1],
  };

  /* ---------------- rig ---------------- */

  const q = (sel) => host.querySelector(sel);

  let curChar = 'cat';
  let curDef = CHARS.cat;
  let rig = {};

  function buildChar(id) {
    const def = CHARS[id] || CHARS.cat;
    curChar = CHARS[id] ? id : 'cat';
    curDef = def;
    host.innerHTML = def.svg + '<div class="fx" aria-hidden="true"></div>';
    rig = {
      fx: q('.fx'),
      lean: q('.lean'),
      root: q('.char-root'),
      head: q('.head'),
      earL: q('.ear-l'),
      earR: q('.ear-r'),
      eyeL: q('.eye-l'),
      eyeR: q('.eye-r'),
      pupilL: q('.pupil-l'),
      pupilR: q('.pupil-r'),
      lidL: q('.lid-l'),
      lidR: q('.lid-r'),
      arcL: q('.lid-arc-l'),
      arcR: q('.lid-arc-r'),
      mouthN: q('.mouth-normal'),
      mouthY: q('.mouth-yawn'),
      oral: q('.yawn-oral'),
      tongue: q('.tongue'),
      lidTravel: def.lidTravel,
      pupilAmp: def.pupilAmp,
    };
    // a rebuild mid-sleep must keep the closed eyes / Zzz state
    if (st.sleeping && rig.root) rig.root.classList.add('sleeping');
  }

  /* ---------------- state ---------------- */

  const st = {
    cx: 0, cy: 0, // cursor, normalized -1..1
    px: 0, py: 0, // eased pupil offset
    lid: 0, // eased lid 0 (open) … 1 (closed)
    squint: 0, squintTarget: 0, squintUntil: 0,
    blinkEnd: 0, blinkDur: 140, nextBlink: 0,
    yawnStart: 0, yawnEnd: 0, yawnDur: 1400,
    startleEnd: 0, lastStartle: -1e9,
    wakeEnd: 0, // night sleep is suspended until this time
    idleAt: 0, // last meaningful cursor movement
    headRot: 0,
    twitchAt: 0, twitchEnd: 0, twitchSide: 1,
    lastX: 0, lastY: 0, lastMoveT: 0,
    sleeping: false,
    // reactions / moods
    wideEnd: 0, wide: 0, // eyes-wide envelope
    winceEnd: 0, // volume-down duck
    tiltUntil: 0, tiltSide: 1, // settings notice head tilt
    lookStart: 0, lookDur: 0, lookUntil: 0, // idle look-around sweep
    perk: 0, perkTarget: 0, // cursor proximity
    corner: [1, 1], // position hint for proximity math
    lastReact: {},
    lastVol: null,
    nextIdle: 0,
    // petting / affection / gaze
    hover: false, petting: false, nextHeart: 0,
    love: 0, combo: 0, lastPet: -1e9, wagUntil: 0,
    glanceEnd: 0, lastSleepE: -1e9,
  };

  let enabled = false;
  let raf = 0;
  let lastT = 0;
  let animTimer = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ss = (a, b, x) => {
    const t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };

  /* ---------------- animations ---------------- */

  function playAnim(cls) {
    if (!rig.lean || !ANIM_DUR[cls]) return;
    rig.lean.classList.remove(...ANIM_CLASSES);
    void rig.lean.getBoundingClientRect(); // restart the keyframes
    rig.lean.classList.add(cls);
    if (cls === 'a-wag') st.wagUntil = performance.now() + ANIM_DUR[cls];
    clearTimeout(animTimer);
    animTimer = setTimeout(() => {
      if (rig.lean) rig.lean.classList.remove(cls);
    }, ANIM_DUR[cls]);
  }

  function react(name) {
    if (!enabled) return;
    const now = performance.now();
    if (now - (st.lastReact[name] || -1e9) < (COOLDOWN[name] || 1200)) return;
    const r = curDef.reactions[name];
    if (!r) return;
    if (st.sleeping) {
      // only a right-click or a new wallpaper is worth waking the pet
      if (name === 'right' || name === 'wallpaper') st.wakeEnd = now + 8000;
      else return;
    }
    st.lastReact[name] = now;
    if (EMOJI[name]) spawnEmoji(EMOJI[name]);
    if (r.anim) playAnim(r.anim);
    if (r.startle) st.startleEnd = now + 400;
    if (r.wide) st.wideEnd = Math.max(st.wideEnd, now + 550);
    if (r.wince) st.winceEnd = now + 950;
    if (r.tilt) {
      st.tiltUntil = now + 1400;
      st.tiltSide = Math.random() < 0.5 ? -1 : 1;
    }
  }

  function pickIdle() {
    const now = performance.now();
    if (!enabled) return;
    if (st.sleeping) {
      st.nextIdle = now + 4000; // keep the cadence alive through the night
      return;
    }
    if (now > st.yawnEnd && now > st.startleEnd) {
      const pool = curDef.idlePool;
      const pick = pool[(Math.random() * pool.length) | 0];
      if (pick === 'look') {
        st.lookStart = now;
        st.lookDur = 1700 + Math.random() * 900;
        st.lookUntil = st.lookStart + st.lookDur;
      } else if (pick === 'yawn') {
        st.yawnStart = now;
        st.yawnDur = 1100 + Math.random() * 700;
        st.yawnEnd = now + st.yawnDur;
        spawnEmoji('😪', { x: 46 });
      } else if (pick === 'earflick') {
        st.twitchAt = now;
      } else if (pick === 'wag') {
        playAnim('a-wag');
      } else {
        const map = { stretch: 'a-stretch', shake: 'a-shake', hop: 'a-hop', jiggle: 'a-jiggle', dance: 'a-dance', wiggle: 'a-pet' };
        if (map[pick]) playAnim(map[pick]);
      }
    }
    st.nextIdle = now + (st.love > 0.5 ? 5200 + Math.random() * 4600 : 8000 + Math.random() * 9000);
  }

  /* ---------------- petting + emoji fx ---------------- */

  // floating emoji above the character (states / actions)
  function spawnEmoji(ch, opts) {
    const fx = rig.fx;
    if (!fx || !enabled) return;
    if (fx.childElementCount >= 8) return;
    opts = opts || {};
    const s = document.createElement('span');
    s.className = 'emo';
    s.textContent = ch;
    s.style.left = (opts.x != null ? opts.x : 34 + Math.random() * 32) + '%';
    s.style.setProperty('--dx', ((Math.random() * 26) - 13).toFixed(1) + 'px');
    s.style.setProperty('--rot', ((Math.random() * 24) - 12).toFixed(1) + 'deg');
    s.style.animationDuration = (1.25 + Math.random() * 0.5).toFixed(2) + 's';
    s.addEventListener('animationend', () => s.remove());
    fx.appendChild(s);
  }

  // cursor position in viewport CSS px — main normalizes against the window's
  // model bounds, which equal the display bounds in screen space
  function cursorCSS() {
    return {
      x: ((st.cx + 1) / 2) * screen.width,
      y: ((st.cy + 1) / 2) * screen.height,
    };
  }

  // is the cursor on the companion? (+ where, -1..1 within its box)
  function measureHover() {
    const r = host.getBoundingClientRect();
    if (!r.width) return { over: false, hx: 0, hy: 0 };
    const c = cursorCSS();
    return {
      over: c.x >= r.left && c.x <= r.right && c.y >= r.top && c.y <= r.bottom,
      hx: clamp(((c.x - r.left) / r.width) * 2 - 1, -1, 1),
      hy: clamp(((c.y - r.top) / r.height) * 2 - 1, -1, 1),
    };
  }

  function startPet() {
    const now = performance.now();
    st.combo = now - st.lastPet < 1400 ? st.combo + 1 : 1;
    st.lastPet = now;
    st.love = Math.min(1, st.love + (st.combo >= 3 ? 0.6 : 0.45));
    st.petting = true;
    st.nextHeart = now + 420;
    st.wagUntil = now + 2400;
    spawnEmoji(st.combo >= 3 ? '💕' : '❤️', { x: 40 + Math.random() * 20 });
    react('pet');
  }

  function stopPet() { st.petting = false; }

  /* ---------------- frame loop ---------------- */

  function frame(t) {
    raf = requestAnimationFrame(frame);
    const dt = clamp(t - (lastT || t), 0, 50);
    lastT = t;
    const now = t;

    // ---- ambient states ----
    const hour = new Date().getHours();
    const night = hour >= 23 || hour < 7;
    const sleeping = night && now > st.wakeEnd;
    const idle = now - st.idleAt;
    const dozing = !sleeping && idle > 20000 && now > st.yawnEnd;
    if (sleeping !== st.sleeping) {
      st.sleeping = sleeping;
      if (rig.root) rig.root.classList.toggle('sleeping', sleeping);
      if (!sleeping) {
        // waking up = stretch
        st.wideEnd = now + 500;
        playAnim('a-stretch');
      } else if (now - st.lastSleepE > 30000) {
        st.lastSleepE = now;
        spawnEmoji('😴', { x: 58 });
      }
    }

    // ---- hover + affection ----
    const hit = measureHover();
    st.hover = hit.over;
    st.love = Math.max(0, st.love - dt / 30000);
    host.classList.toggle('loved', st.love > 0.35);
    if (now - st.lastPet > 2500) st.combo = 0;
    host.classList.toggle('wagging', now < st.wagUntil);
    // proximity perk: sitting on the pet = full perk, near its anchor = light
    const cd = Math.hypot(st.cx - st.corner[0], st.cy - st.corner[1]);
    st.perkTarget = hit.over ? 1 : (cd < 0.5 ? 0.4 : 0);

    // ---- petting stream: hearts while the button stays down on the pet ----
    if (st.petting) {
      if (!hit.over) st.petting = false;
      else if (now >= st.nextHeart) {
        st.nextHeart = now + 470;
        spawnEmoji('❤️', { x: 34 + Math.random() * 32 });
        st.squint = Math.max(st.squint, 0.5);
        st.squintTarget = 0.5;
        st.squintUntil = now + 320;
        st.wagUntil = now + 1800;
      }
    }

    // ---- idle animation scheduler ----
    if (now >= st.nextIdle) pickIdle();

    // ---- random blink ----
    if (!sleeping && now >= st.nextBlink) {
      st.blinkDur = 140;
      st.blinkEnd = now + st.blinkDur;
      st.nextBlink = now + 2600 + Math.random() * 3600;
    }
    let blink = 0;
    if (now < st.blinkEnd) {
      const p = 1 - (st.blinkEnd - now) / st.blinkDur;
      blink = p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55;
    }

    // ---- brightness squint (eased, decays after hold) ----
    if (now > st.squintUntil) st.squintTarget = 0;
    st.squint += (st.squintTarget - st.squint) * clamp(dt * 0.012, 0, 1);

    // ---- yawn envelope ----
    let yawn = 0;
    if (now < st.yawnEnd) {
      const p = clamp((now - st.yawnStart) / st.yawnDur, 0, 1);
      yawn = Math.sin(Math.PI * p);
    }

    // ---- startle (fast swipe) ----
    let startle = 0;
    if (now < st.startleEnd) startle = clamp((st.startleEnd - now) / 200, 0, 1);

    // ---- eyes-wide + proximity perk easing ----
    const wideT = now < st.wideEnd ? 1 : 0;
    st.wide += (wideT - st.wide) * clamp(dt * 0.01, 0, 1);
    st.perk += (st.perkTarget - st.perk) * clamp(dt * 0.006, 0, 1);

    // ---- composite eyelid ----
    let lidT = sleeping ? 1 : 0;
    lidT = Math.max(lidT, blink, st.squint, yawn * 0.85, dozing ? 0.72 : 0);
    if (now < st.winceEnd) lidT = Math.max(lidT, 0.55);
    if (startle > 0.5) lidT = 0; // eyes snap wide
    const lidRate = lidT > st.lid ? 0.04 : 0.02;
    st.lid += (lidT - st.lid) * clamp(dt * lidRate, 0, 1);
    if (Math.abs(lidT - st.lid) < 0.003) st.lid = lidT;

    // ---- head: sleep/doze tilt, wince duck, idle look sweep, edge look ----
    let headT = 0;
    if (sleeping) headT = 7;
    else if (now < st.winceEnd) headT = 9;
    else if (now < st.tiltUntil) headT = st.tiltSide * 9;
    else if (now < st.lookUntil) {
      headT = Math.sin(((now - st.lookStart) / Math.max(1, st.lookDur)) * Math.PI * 2) * 11;
    } else if (now < st.glanceEnd) headT = clamp(st.cx * 12, -12, 12);
    else if (dozing) headT = 5;
    else if (hit.over) headT = clamp(hit.hx * 9 + hit.hy * 4, -12, 12); // gaze at the cursor
    else if (st.perk > 0.5) headT = st.cx * 6;
    else if (st.cx > 0.8) headT = 7;
    else if (st.cx < -0.8) headT = -7;
    st.headRot += (headT - st.headRot) * clamp(dt * 0.004, 0, 1);

    // ---- ears: startle/wince flatten, perk up, random twitch ----
    if (now >= st.twitchAt) {
      st.twitchAt = now + 4000 + Math.random() * 5000;
      st.twitchSide = Math.random() < 0.5 ? -1 : 1;
      st.twitchEnd = now + 160;
    }
    let earLT = -24 * startle + 8 * st.perk;
    let earRT = 24 * startle - 8 * st.perk;
    if (now < st.winceEnd) {
      earLT = Math.min(earLT, -26);
      earRT = Math.max(earRT, 26);
    }
    if (now < st.twitchEnd) {
      const k = Math.sin((1 - (st.twitchEnd - now) / 160) * Math.PI) * 9 * st.twitchSide;
      if (st.twitchSide < 0) earLT += k;
      else earRT += k;
    }

    // ---- pupils chase the cursor (eased + clamped) ----
    const [ampX, ampY] = rig.pupilAmp || [5.5, 4.5];
    const tx = clamp(st.cx, -1, 1) * ampX;
    const ty = clamp(st.cy, -1, 1) * ampY;
    const pk = clamp(dt * 0.012, 0, 1);
    st.px += (tx - st.px) * pk;
    st.py += (ty - st.py) * pk;

    const eyeScale = 1 + startle * 0.18 + st.wide * 0.15 + st.perk * 0.06;

    // ---- paint (every part is optional per character) ----
    const lidPx = (st.lid * (rig.lidTravel || 30)).toFixed(2);
    if (rig.lidL) rig.lidL.style.transform = `translateY(${lidPx}px)`;
    if (rig.lidR) rig.lidR.style.transform = `translateY(${lidPx}px)`;
    const arcOp = ss(0.72, 0.98, st.lid).toFixed(2);
    if (rig.arcL) rig.arcL.style.opacity = arcOp;
    if (rig.arcR) rig.arcR.style.opacity = arcOp;
    const pupilT = `translate(${st.px.toFixed(2)}px, ${st.py.toFixed(2)}px)`;
    if (rig.pupilL) rig.pupilL.style.transform = pupilT;
    if (rig.pupilR) rig.pupilR.style.transform = pupilT;
    const eyeT = `scale(${eyeScale.toFixed(3)})`;
    if (rig.eyeL) rig.eyeL.style.transform = eyeT;
    if (rig.eyeR) rig.eyeR.style.transform = eyeT;
    if (rig.head) rig.head.style.transform = `rotate(${st.headRot.toFixed(2)}deg)`;
    if (rig.earL) rig.earL.style.transform = `rotate(${earLT.toFixed(2)}deg)`;
    if (rig.earR) rig.earR.style.transform = `rotate(${earRT.toFixed(2)}deg)`;
    if (rig.oral) rig.oral.setAttribute('ry', (1 + yawn * 11).toFixed(1));
    if (rig.tongue) rig.tongue.setAttribute('ry', (1 + yawn * 4.5).toFixed(1));
    if (rig.mouthY) rig.mouthY.style.opacity = yawn > 0.02 ? '1' : '0';
    if (rig.mouthN) rig.mouthN.style.opacity = (1 - yawn).toFixed(2);
  }

  /* ---------------- public API ---------------- */

  buildChar('cat');

  window.wallflowCompanion = {
    setEnabled(on) {
      on = !!on;
      if (on === enabled) return;
      enabled = on;
      if (on) {
        const now = performance.now();
        st.idleAt = now;
        st.lastMoveT = now;
        st.nextBlink = now + 1200;
        st.twitchAt = now + 2500;
        st.nextIdle = now + 5500;
        st.lastReact = {};
        lastT = 0;
        raf = requestAnimationFrame(frame);
        playAnim('a-enter'); // bounce-in entrance
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
        clearTimeout(animTimer);
        if (rig.lean) rig.lean.classList.remove(...ANIM_CLASSES);
        host.classList.remove('wagging', 'loved');
        st.petting = false;
        st.combo = 0;
        if (rig.fx) rig.fx.innerHTML = '';
      }
    },

    // switch character at runtime (rebuilds the SVG rig)
    setCharacter(id) {
      if (!CHARS[id] || (id === curChar && rig.root)) return;
      const wasEnabled = enabled;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      clearTimeout(animTimer);
      buildChar(id);
      if (wasEnabled) {
        const now = performance.now();
        st.idleAt = now;
        st.nextBlink = now + 900;
        st.nextIdle = now + 6000;
        lastT = 0;
        raf = requestAnimationFrame(frame);
        playAnim('a-enter');
      }
    },

    // corner/edge the companion is anchored to — used for proximity moods
    setPositionHint(pos) {
      st.corner = CORNERS[pos] || [1, 1];
    },

    // normalized -1..1 from the shared wallpaper:parallax feed
    setCursor(p) {
      if (!p) return;
      const now = performance.now();
      const dx = p.x - st.lastX;
      const dy = p.y - st.lastY;
      const dist = Math.hypot(dx, dy);
      const dtm = now - st.lastMoveT;
      if (dist > 0.004) {
        st.idleAt = now;
        st.wakeEnd = now + 6000; // cursor move wakes the sleeping pet
        // fast swipe → startle (throttled)
        if (dtm >= 8 && dtm < 500 && dist / (dtm / 1000) > 4 && now - st.lastStartle > 1800) {
          st.lastStartle = now;
          st.startleEnd = now + 400;
          st.wakeEnd = now + 3000;
          spawnEmoji('❗');
        }
      }
      st.lastX = p.x;
      st.lastY = p.y;
      st.lastMoveT = now;
      st.cx = p.x;
      st.cy = p.y;
      // (proximity perk is computed in frame() — it needs the host rect)
    },

    // signed brightness delta in percent (from settings diff in app.js)
    onBrightness(delta) {
      if (!delta) return;
      const now = performance.now();
      if (delta > 0) {
        const amt = clamp(delta / 40, 0.25, 0.95);
        st.squint = Math.max(st.squint, amt * 0.6); // snap in for a snappy feel
        st.squintTarget = amt;
        st.squintUntil = now + (delta >= 15 ? 900 : 650);
        if (delta >= 8) spawnEmoji('☀️');
        if (delta >= 15) {
          // big jump → slow affectionate blink + eyes wide after
          st.blinkDur = 380;
          st.blinkEnd = now + st.blinkDur;
          st.nextBlink = now + 3000;
          st.wideEnd = now + 700;
        }
      } else {
        const mag = -delta;
        spawnEmoji('🌙');
        if (now < st.yawnEnd) {
          st.yawnEnd = now + st.yawnDur; // keep yawning through a drag
        } else {
          st.yawnStart = now;
          st.yawnDur = 1200 + Math.min(900, mag * 10);
          st.yawnEnd = now + st.yawnDur;
        }
        st.squint = Math.max(st.squint, 0.3);
        st.squintTarget = Math.max(st.squintTarget, clamp(mag / 50, 0.2, 0.6));
        st.squintUntil = now + 400;
        st.wakeEnd = Math.max(st.wakeEnd, now + st.yawnDur); // yawns wake it up
      }
    },

    // mouse buttons + system volume, streamed from the main-process sensors
    onEvent(ev) {
      if (!enabled || !ev) return;
      if (ev.type === 'mouse') {
        const over = measureHover().over;
        if (ev.button === 'left') {
          if (ev.down) {
            if (over) startPet();
            else {
              react('click'); // anywhere else = generic hop
              st.glanceEnd = performance.now() + 700; // snap a look at the click
            }
          } else stopPet();
        } else if (ev.down) {
          react(over ? 'boop' : 'right'); // poking the pet specifically = boop
        }
      } else if (ev.type === 'volume') {
        const v = Number(ev.value);
        if (!Number.isFinite(v)) return;
        if (st.lastVol === null) {
          st.lastVol = v; // first reading is just the baseline
          return;
        }
        const d = v - st.lastVol;
        st.lastVol = v;
        if (Math.abs(d) >= 3) react(d > 0 ? 'volumeUp' : 'volumeDown');
      }
    },

    // a new wallpaper landed (selection / preview / playlist rotation)
    onWallpaperChange() {
      react('wallpaper');
    },

    // any non-brightness settings change (throttled by cooldown)
    onNotice() {
      react('notice');
    },
  };
})();
