// Design Extractor - Content Script
// Runs on the active page and extracts design system data

(function() {
  'use strict';

  function extractDesignData() {
    const cssVariables = extractCSSVariables();
    const colors = extractColors();
    const shadows = extractShadows();
    const gradients = extractGradients();
    const animations = extractAnimations();

    return {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      colors,
      colorRoles: inferColorRoles(colors, cssVariables),
      typography: extractTypography(),
      spacing: extractSpacing(),
      borderRadius: extractBorderRadius(),
      shadows,
      gradients,
      cssVariables,
      components: extractComponents(),
      buttonVariants: extractButtonVariants(),
      interactionStates: extractInteractionStates(),
      breakpoints: extractBreakpoints(),
      fonts: extractFonts(),
      icons: extractIconLibraries(),
      animations,
      zIndex: extractZIndex(),
      decorative: extractScrollbarAndSelection(),
      meta: extractMeta(),
      theme: inferVisualTheme(colors, shadows, gradients, animations)
    };
  }

  // ─── Colors ──────────────────────────────────────────────────────────────────

  function extractColors() {
    const colorMap = new Map();
    const elements = document.querySelectorAll('*');
    const limit = Math.min(elements.length, 500);

    for (let i = 0; i < limit; i++) {
      const el = elements[i];
      const styles = window.getComputedStyle(el);
      ['color', 'background-color', 'border-color'].forEach(prop => {
        const val = styles.getPropertyValue(prop);
        if (val && val !== 'rgba(0, 0, 0, 0)' && val !== 'transparent') {
          const hex = rgbToHex(val);
          if (hex) colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
        }
      });
    }

    return Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([color, count]) => ({ color, count }));
  }

  function inferColorRoles(colors, cssVars) {
    const roles = { backgrounds: [], surfaces: [], text: [], borders: [], accents: [], semantic: {} };

    // First pass: CSS variable names are the most reliable signal
    Object.entries(cssVars).forEach(([k, v]) => {
      const key = k.toLowerCase();
      const val = v.trim();
      if (!val.startsWith('#') && !val.match(/^rgb/)) return;

      if (/background|--bg|surface/.test(key))        roles.backgrounds.push({ name: k, value: val });
      else if (/text|foreground|content/.test(key))   roles.text.push({ name: k, value: val });
      else if (/border|divider|separator/.test(key))  roles.borders.push({ name: k, value: val });
      else if (/primary|accent|brand/.test(key))      roles.accents.push({ name: k, value: val });
      else if (/success|positive/.test(key))          roles.semantic.success = val;
      else if (/warning|caution/.test(key))           roles.semantic.warning = val;
      else if (/error|danger|destructive/.test(key))  roles.semantic.error = val;
      else if (/info/.test(key))                      roles.semantic.info = val;
    });

    // Second pass: classify by luminance when CSS vars are sparse
    colors.slice(0, 10).forEach(({ color }) => {
      const lum = getLuminance(color);
      const sat = getSaturation(color);
      if (lum > 0.85 && roles.backgrounds.length === 0)
        roles.backgrounds.push({ name: 'background', value: color });
      else if (lum > 0.5 && lum <= 0.85 && roles.surfaces.length < 2)
        roles.surfaces.push({ name: 'surface', value: color });
      else if (lum < 0.04 && roles.text.length === 0)
        roles.text.push({ name: 'text-primary', value: color });
    });

    // Third pass: accent colors — high saturation colors regardless of frequency
    // Look at colors used on CTAs, links, focused elements
    const accentHexes = new Set(roles.accents.map(a => a.value.toUpperCase()));
    extractAccentColors().forEach(({ color, source }) => {
      if (!accentHexes.has(color)) {
        roles.accents.push({ name: source, value: color });
        accentHexes.add(color);
      }
    });

    // Also flag saturated colors from frequency list that weren't classified
    colors.slice(0, 5).forEach(({ color }) => {
      if (accentHexes.size >= 8) return;
      if (getSaturation(color) > 0.4 && getLuminance(color) > 0.02 && getLuminance(color) < 0.95) {
        if (!accentHexes.has(color)) {
          roles.accents.push({ name: 'accent', value: color });
          accentHexes.add(color);
        }
      }
    });

    return roles;
  }

  function extractAccentColors() {
    const results = [];
    const seen = new Set();

    // Button backgrounds
    document.querySelectorAll('button, [class*="btn"], [role="button"], a[class*="cta"], a[class*="button"]').forEach(el => {
      const s = window.getComputedStyle(el);
      const hex = rgbToHex(s.backgroundColor);
      if (hex && !seen.has(hex) && getSaturation(hex) > 0.3) {
        results.push({ color: hex, source: 'button-bg' });
        seen.add(hex);
      }
      // also text color if it's on a button
      const textHex = rgbToHex(s.color);
      if (textHex && !seen.has(textHex) && getSaturation(textHex) > 0.3) {
        results.push({ color: textHex, source: 'button-text' });
        seen.add(textHex);
      }
    });

    // Link colors
    document.querySelectorAll('a').forEach(el => {
      const hex = rgbToHex(window.getComputedStyle(el).color);
      if (hex && !seen.has(hex) && getSaturation(hex) > 0.3) {
        results.push({ color: hex, source: 'link-color' });
        seen.add(hex);
      }
    });

    // SVG fill colors
    document.querySelectorAll('svg path, svg circle, svg rect').forEach(el => {
      const s = window.getComputedStyle(el);
      const fill = s.fill;
      if (fill && fill !== 'none' && fill !== 'rgb(0, 0, 0)') {
        const hex = rgbToHex(fill);
        if (hex && !seen.has(hex) && getSaturation(hex) > 0.3) {
          results.push({ color: hex, source: 'svg-fill' });
          seen.add(hex);
        }
      }
    });

    return results.slice(0, 6);
  }

  // ─── Typography ──────────────────────────────────────────────────────────────

  function extractTypography() {
    const selectors = ['h1', 'h2', 'h3', 'h4', 'p', 'a', 'button', 'small', 'label', 'code'];
    const result = {};

    selectors.forEach(selector => {
      const el = document.querySelector(selector);
      if (el) {
        const s = window.getComputedStyle(el);
        const featureSettings = s.getPropertyValue('font-feature-settings');
        result[selector] = {
          fontFamily: s.fontFamily,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          lineHeight: s.lineHeight,
          letterSpacing: s.letterSpacing !== 'normal' ? s.letterSpacing : '—',
          textTransform: s.textTransform !== 'none' ? s.textTransform : null,
          color: rgbToHex(s.color) || s.color,
          fontFeatureSettings: featureSettings && featureSettings !== 'normal' ? featureSettings : null
        };
      }
    });

    // Detect fluid typography: if sizes have many decimal places, they're likely vw/clamp-based
    const sizes = Object.values(result).map(t => parseFloat(t.fontSize)).filter(Boolean);
    const fractionalCount = sizes.filter(s => Math.abs(s - Math.round(s)) > 0.1).length;
    result._isFluid = fractionalCount > sizes.length * 0.4;

    return result;
  }

  // ─── Spacing ─────────────────────────────────────────────────────────────────

  function extractSpacing() {
    const spacingSet = new Set();
    const elements = document.querySelectorAll('*');
    const limit = Math.min(elements.length, 200);

    for (let i = 0; i < limit; i++) {
      const s = window.getComputedStyle(elements[i]);
      ['padding-top','padding-right','padding-bottom','padding-left',
       'margin-top','margin-right','margin-bottom','margin-left',
       'gap','row-gap','column-gap'].forEach(prop => {
        const val = s.getPropertyValue(prop);
        if (val && val !== '0px') spacingSet.add(val);
      });
    }

    const values = deduplicateByRounding(
      Array.from(spacingSet)
        .filter(v => v.endsWith('px') || v.endsWith('rem'))
        .sort((a, b) => parseFloat(a) - parseFloat(b)),
      1.0  // group values within 1px of each other
    ).slice(0, 20);

    return { values, baseUnit: inferBaseUnit(values) };
  }

  function inferBaseUnit(values) {
    const px = values.filter(v => v.endsWith('px')).map(v => parseFloat(v));
    if (px.length === 0) return '8px';
    // Check divisibility by 4 and 8
    const div8 = px.filter(v => v % 8 === 0).length;
    const div4 = px.filter(v => v % 4 === 0).length;
    if (div8 / px.length > 0.6) return '8px';
    if (div4 / px.length > 0.5) return '4px';
    return '8px'; // sensible default
  }

  // ─── Border Radius ───────────────────────────────────────────────────────────

  function extractBorderRadius() {
    const radiusSet = new Set();
    const els = document.querySelectorAll('button, input, [class*="card"], [class*="btn"], img, [class*="badge"], [class*="tag"], [class*="chip"], dialog, [role="dialog"]');

    els.forEach(el => {
      const r = window.getComputedStyle(el).borderRadius;
      if (r && r !== '0px') radiusSet.add(r);
    });

    return Array.from(radiusSet)
      .sort((a, b) => parseFloat(a) - parseFloat(b))
      .slice(0, 10);
  }

  // ─── Shadows ─────────────────────────────────────────────────────────────────

  function extractShadows() {
    const shadowSet = new Set();
    const elements = document.querySelectorAll('*');
    const limit = Math.min(elements.length, 300);

    for (let i = 0; i < limit; i++) {
      const shadow = window.getComputedStyle(elements[i]).boxShadow;
      if (shadow && shadow !== 'none') shadowSet.add(shadow);
    }

    return Array.from(shadowSet).slice(0, 10);
  }

  // ─── Gradients ───────────────────────────────────────────────────────────────

  function extractGradients() {
    const backgrounds = new Set();
    const buttons = new Set();
    const textGradients = new Set();
    const glassmorphism = [];

    const elements = document.querySelectorAll('*');
    const limit = Math.min(elements.length, 400);

    for (let i = 0; i < limit; i++) {
      const el = elements[i];
      const s = window.getComputedStyle(el);
      const bgImage = s.backgroundImage;

      if (bgImage && bgImage !== 'none' && bgImage.includes('gradient') && !isMonoGradient(bgImage)) {
        const tag = el.tagName.toLowerCase();
        const isBtn = tag === 'button' || el.getAttribute('role') === 'button' ||
                      (el.className && /btn|button/i.test(el.className));
        if (isBtn) buttons.add(bgImage);
        else backgrounds.add(bgImage);
      }

      // Text gradient (webkit-background-clip: text)
      const bgClip = s.webkitBackgroundClip || s.backgroundClip;
      if (bgClip === 'text' && bgImage && bgImage.includes('gradient')) {
        textGradients.add(bgImage);
      }

      // Glassmorphism
      const bf = s.backdropFilter || s.webkitBackdropFilter;
      if (bf && bf !== 'none' && bf.includes('blur') && glassmorphism.length < 3) {
        glassmorphism.push({
          backdropFilter: bf,
          background: s.backgroundColor,
          border: s.borderColor !== 'rgb(0, 0, 0)' ? s.borderColor : null
        });
      }
    }

    return {
      backgrounds: Array.from(backgrounds).slice(0, 6),
      buttons: Array.from(buttons).slice(0, 3),
      text: Array.from(textGradients).slice(0, 3),
      glassmorphism: glassmorphism.slice(0, 2)
    };
  }

  // ─── Animations ──────────────────────────────────────────────────────────────

  function extractAnimations() {
    const transitions = new Set();
    const animations = new Set();
    const keyframeNames = [];

    // Scan interactive elements for transitions
    const interactives = document.querySelectorAll('button, a, input, select, [class*="btn"], [class*="card"], [class*="nav"] *, header *');
    interactives.forEach(el => {
      const s = window.getComputedStyle(el);
      const t = s.transition;
      if (t && t !== 'none' && t !== 'all 0s ease 0s') transitions.add(t);
      const a = s.animation;
      if (a && a !== 'none') animations.add(a);
    });

    // Scan keyframes from accessible stylesheets
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule instanceof CSSKeyframesRule) keyframeNames.push(rule.name);
        });
      } catch(e) {}
    });

    // Detect JS animation libraries
    const libraries = [];
    if (window.gsap || window.TweenMax || window.TweenLite) libraries.push('GSAP');
    if (window.ScrollTrigger || document.querySelector('[data-scroll-trigger]')) libraries.push('GSAP ScrollTrigger');
    if (document.querySelector('[data-aos]') || window.AOS) libraries.push('AOS');
    if (window.Lenis) libraries.push('Lenis (smooth scroll)');
    if (document.querySelector('[data-framer-motion], [style*="--framer"]') || window.FramerMotion) libraries.push('Framer Motion');
    if (window.anime) libraries.push('Anime.js');
    if (window.ScrollReveal) libraries.push('ScrollReveal');
    if (window.lottie || document.querySelector('lottie-player, [data-lottie]')) libraries.push('Lottie');
    if (window.THREE) libraries.push('Three.js');
    if (window.Swiper) libraries.push('Swiper');

    return {
      transitions: Array.from(transitions).slice(0, 8),
      animations: Array.from(animations).slice(0, 5),
      keyframes: keyframeNames.slice(0, 10),
      libraries
    };
  }

  // ─── Z-Index ─────────────────────────────────────────────────────────────────

  function extractZIndex() {
    const zSet = new Set();
    const elements = document.querySelectorAll('*');
    const limit = Math.min(elements.length, 300);

    for (let i = 0; i < limit; i++) {
      const z = window.getComputedStyle(elements[i]).zIndex;
      if (z && z !== 'auto' && z !== '0') zSet.add(parseInt(z));
    }

    return Array.from(zSet)
      .filter(z => !isNaN(z))
      .sort((a, b) => a - b)
      .slice(0, 10);
  }

  // ─── Scrollbar & Selection ───────────────────────────────────────────────────

  function extractScrollbarAndSelection() {
    const result = { scrollbar: {}, selection: null };

    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          const sel = rule.selectorText || '';
          if (sel.includes('::-webkit-scrollbar')) {
            if (!sel.includes('thumb') && !sel.includes('track')) {
              result.scrollbar.width = rule.style.width;
              result.scrollbar.height = rule.style.height;
            }
            if (sel.includes('thumb')) {
              result.scrollbar.thumbColor = rule.style.backgroundColor;
              result.scrollbar.thumbRadius = rule.style.borderRadius;
              result.scrollbar.thumbHover = null; // gets overwritten if :hover rule exists
            }
            if (sel.includes('track')) {
              result.scrollbar.trackColor = rule.style.backgroundColor;
            }
          }
          if (sel.includes('::selection') || sel.includes('::-moz-selection')) {
            result.selection = {
              background: rule.style.backgroundColor,
              color: rule.style.color
            };
          }
        });
      } catch(e) {}
    });

    return result;
  }

  // ─── CSS Variables ───────────────────────────────────────────────────────────

  function extractCSSVariables() {
    const variables = {};

    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule.selectorText === ':root' || rule.selectorText === 'html') {
            const style = rule.style;
            for (let i = 0; i < style.length; i++) {
              const prop = style[i];
              if (prop.startsWith('--')) {
                variables[prop] = style.getPropertyValue(prop).trim();
              }
            }
          }
        });
      } catch(e) {}
    });

    return variables;
  }

  // ─── Components ──────────────────────────────────────────────────────────────

  function extractComponents() {
    const components = {};

    // Buttons — pick the most visually distinct button (has background + contrast)
    const buttons = document.querySelectorAll('button, [class*="btn"], [role="button"]');
    if (buttons.length > 0) {
      const btn = pickBestButton(Array.from(buttons));
      const s = window.getComputedStyle(btn);
      components.button = {
        count: buttons.length,
        sample: {
          backgroundColor: rgbToHex(s.backgroundColor) || s.backgroundColor,
          color: rgbToHex(s.color) || s.color,
          padding: s.padding,
          borderRadius: s.borderRadius,
          fontSize: s.fontSize,
          fontWeight: s.fontWeight,
          border: cleanBorder(s.border),
          transition: s.transition !== 'none' && s.transition !== 'all 0s ease 0s' ? s.transition : null,
          letterSpacing: s.letterSpacing !== 'normal' ? s.letterSpacing : null,
          textTransform: s.textTransform !== 'none' ? s.textTransform : null
        }
      };
    }

    // Inputs
    const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="search"], input:not([type])');
    if (inputs.length > 0) {
      const input = inputs[0];
      const s = window.getComputedStyle(input);
      components.input = {
        count: inputs.length,
        sample: {
          backgroundColor: rgbToHex(s.backgroundColor) || s.backgroundColor,
          border: cleanBorder(s.border),
          borderRadius: s.borderRadius,
          padding: s.padding,
          fontSize: s.fontSize,
          color: rgbToHex(s.color) || s.color
        }
      };
    }

    // Cards
    const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');
    if (cards.length > 0) {
      const card = cards[0];
      const s = window.getComputedStyle(card);
      components.card = {
        count: cards.length,
        sample: {
          backgroundColor: rgbToHex(s.backgroundColor) || s.backgroundColor,
          border: cleanBorder(s.border),
          borderRadius: s.borderRadius,
          padding: s.padding,
          boxShadow: s.boxShadow !== 'none' ? s.boxShadow : null,
          transition: s.transition !== 'none' && s.transition !== 'all 0s ease 0s' ? s.transition : null
        }
      };
    }

    // Navigation
    const navs = document.querySelectorAll('nav, header, [class*="navbar"], [class*="header"]');
    if (navs.length > 0) {
      const nav = navs[0];
      const s = window.getComputedStyle(nav);
      components.navigation = {
        backgroundColor: rgbToHex(s.backgroundColor) || s.backgroundColor,
        height: s.height,
        borderBottom: s.borderBottom,
        backdropFilter: s.backdropFilter !== 'none' ? s.backdropFilter : null
      };
    }

    // Badges / Tags
    const badges = document.querySelectorAll('[class*="badge"], [class*="tag"], [class*="chip"], [class*="pill"]');
    if (badges.length > 0) {
      const badge = badges[0];
      const s = window.getComputedStyle(badge);
      components.badge = {
        count: badges.length,
        sample: {
          backgroundColor: rgbToHex(s.backgroundColor) || s.backgroundColor,
          color: rgbToHex(s.color) || s.color,
          borderRadius: s.borderRadius,
          padding: s.padding,
          fontSize: s.fontSize
        }
      };
    }

    return components;
  }

  // ─── Breakpoints ─────────────────────────────────────────────────────────────

  function extractBreakpoints() {
    const breakpoints = new Set();

    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          if (rule instanceof CSSMediaRule) {
            const media = rule.conditionText || rule.media.mediaText;
            const matches = media.match(/\d+px/g);
            if (matches) matches.forEach(bp => breakpoints.add(bp));
          }
        });
      } catch(e) {}
    });

    return Array.from(breakpoints)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .slice(0, 10);
  }

  // ─── Fonts ───────────────────────────────────────────────────────────────────

  function extractFonts() {
    const fontSet = new Set();
    const monoFonts = new Set();
    const elements = document.querySelectorAll('*');
    const limit = Math.min(elements.length, 300);

    for (let i = 0; i < limit; i++) {
      const s = window.getComputedStyle(elements[i]);
      const family = s.fontFamily;
      if (!family) continue;
      const primary = family.split(',')[0].replace(/['"]/g, '').trim();
      if (!primary || ['serif','sans-serif','monospace','cursive','fantasy','system-ui'].includes(primary)) continue;

      if (/mono|code|console|courier|menlo|fira.*code|jetbrains|source.*code|cascadia/i.test(primary)) {
        monoFonts.add(primary);
      } else {
        fontSet.add(primary);
      }
    }

    const googleFonts = [];
    document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach(link => {
      googleFonts.push(link.href);
    });

    return {
      detected: Array.from(fontSet).slice(0, 6),
      mono: Array.from(monoFonts).slice(0, 3),
      googleFontsUrls: googleFonts
    };
  }

  // ─── Icon Libraries ──────────────────────────────────────────────────────────

  function extractIconLibraries() {
    const icons = [];

    if (document.querySelector('[class*="fa-"]'))                            icons.push('Font Awesome');
    if (document.querySelector('[class*="heroicon"]'))                       icons.push('Heroicons');
    if (document.querySelector('[data-lucide], [class*="lucide-"]'))         icons.push('Lucide');
    if (document.querySelector('.material-icons, [class*="material-symbol"]')) icons.push('Material Icons');
    if (document.querySelector('[class*="ph-"]'))                            icons.push('Phosphor Icons');
    if (document.querySelector('[class*="tabler-"]'))                        icons.push('Tabler Icons');
    if (document.querySelector('[class*="ri-"]'))                            icons.push('Remix Icons');
    if (document.querySelectorAll('svg use[href], svg use[xlink\\:href]').length > 0) icons.push('SVG Sprite');

    // Try to infer default icon size from SVGs
    let iconSize = null;
    const svgs = document.querySelectorAll('svg');
    if (svgs.length > 0) {
      const s = window.getComputedStyle(svgs[0]);
      iconSize = s.width !== 'auto' ? s.width : svgs[0].getAttribute('width');
    }

    return { libraries: icons, defaultSize: iconSize };
  }

  // ─── Meta ────────────────────────────────────────────────────────────────────

  function extractMeta() {
    return {
      lang: document.documentElement.lang,
      viewport: document.querySelector('meta[name="viewport"]')?.content,
      themeColor: document.querySelector('meta[name="theme-color"]')?.content,
      colorScheme: document.documentElement.style.colorScheme ||
                   getComputedStyle(document.documentElement).colorScheme,
      framework: detectFramework(),
      cssFramework: detectCSSFramework(),
      animationLibraries: null // filled by extractAnimations
    };
  }

  function detectFramework() {
    if (window.__NEXT_DATA__) return 'Next.js';
    if (window.__nuxt__) return 'Nuxt.js';
    if (window.angular) return 'Angular';
    if (document.querySelector('[data-reactroot], [data-react-helmet], [data-next-page]')) return 'React';
    if (document.querySelector('[data-v-]')) return 'Vue.js';
    if (window.Svelte || document.querySelector('[data-svelte]')) return 'Svelte';
    if (window.Astro) return 'Astro';
    if (document.querySelector('remix-island, [data-remix]')) return 'Remix';
    // Webflow — check before Unknown
    if (window.Webflow ||
        document.querySelector('[data-wf-domain], [data-wf-page], [data-wf-site]') ||
        document.querySelector('meta[name="generator"][content*="Webflow"]') ||
        document.querySelector('link[href*="webflow.com"], script[src*="webflow.com"]')) {
      return 'Webflow';
    }
    if (document.querySelector('[data-drupal-selector], [data-once]')) return 'Drupal';
    if (document.querySelector('#wpadminbar, .wp-block')) return 'WordPress';
    if (document.querySelector('[data-shopify-feature], .shopify-section')) return 'Shopify';
    return 'Unknown';
  }

  function detectCSSFramework() {
    const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => l.href).join(' ');

    // Tailwind: check for utility class patterns
    const allClasses = Array.from(document.querySelectorAll('*'))
      .flatMap(el => Array.from(el.classList))
      .filter(c => /^(flex|grid|text-|bg-|p-\d|m-\d|w-|h-|rounded|border|shadow|font-|gap-|items-|justify-)/.test(c));
    if (allClasses.length > 15) return 'Tailwind CSS';

    if (styleLinks.includes('bootstrap') || document.querySelector('.container-fluid, .row > .col')) return 'Bootstrap';
    if (styleLinks.includes('material') || document.querySelector('.MuiButton-root, .mat-button')) return 'Material UI / MUI';
    if (document.querySelector('[class*="chakra-"]')) return 'Chakra UI';
    if (document.querySelector('[class*="mantine-"]')) return 'Mantine';
    if (document.querySelector('[data-radix-ui], [data-radix]')) return 'Radix UI';
    if (document.querySelector('[class*="shadcn"], [data-slot]')) return 'shadcn/ui';

    return 'Custom CSS';
  }

  // ─── Visual Theme Inference ──────────────────────────────────────────────────

  function inferVisualTheme(colors, shadows, gradients, animations) {
    const topColors = colors.slice(0, 6).map(c => c.color);
    const darkCount = topColors.filter(c => getLuminance(c) < 0.12).length;
    const isDark = darkCount >= 3;

    const isMinimal = shadows.length <= 2;
    // Only count as "has gradients" if they're real (non-mono) gradients — isMonoGradient already filters at extraction
    const hasGradients = gradients.backgrounds.length > 0 || gradients.buttons.length > 0;
    const hasTextGradients = gradients.text.length > 0;
    const hasGlass = gradients.glassmorphism.length > 0;
    const isAnimated = animations.transitions.length > 3 || animations.libraries.length > 0;

    const traits = [];
    traits.push(isDark ? 'Dark theme' : 'Light theme');
    traits.push(isMinimal ? 'minimal / flat' : 'elevated with shadows');
    if (hasGlass) traits.push('glassmorphism elements');
    if (hasGradients) traits.push('gradient backgrounds');
    if (hasTextGradients) traits.push('gradient text');
    if (isAnimated) traits.push('motion-rich');

    return {
      isDark,
      isMinimal,
      hasGradients,
      hasGlass,
      isAnimated,
      description: traits.join(', ')
    };
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  function isMonoGradient(gradient) {
    // Returns true if all color stops in the gradient resolve to the same color
    // e.g. linear-gradient(#fff, #fff) — not a real gradient
    const matches = gradient.match(/rgb[a]?\([^)]+\)/g);
    if (!matches || matches.length < 2) return false;
    const hexes = matches.map(rgbToHex).filter(Boolean);
    if (hexes.length < 2) return false;
    return hexes.every(h => h === hexes[0]);
  }

  function pickBestButton(buttons) {
    // Prefer a button with visible background and text that contrasts it
    for (const btn of buttons) {
      const s = window.getComputedStyle(btn);
      const bg = s.backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') continue;
      const bgHex = rgbToHex(bg);
      const textHex = rgbToHex(s.color);
      if (!bgHex || !textHex) continue;
      const bgLum = getLuminance(bgHex);
      const textLum = getLuminance(textHex);
      const contrast = (Math.max(bgLum, textLum) + 0.05) / (Math.min(bgLum, textLum) + 0.05);
      if (contrast > 1.5) return btn;
    }
    return buttons[0];
  }

  function cleanBorder(border) {
    if (!border) return null;
    // "0px none rgb(...)" or "medium none" = no border
    if (/^0px\s+none|^none|^medium\s+none/.test(border)) return null;
    return border;
  }

  function deduplicateByRounding(values, threshold) {
    const seen = [];
    return values.filter(v => {
      const n = parseFloat(v);
      const isDupe = seen.some(s => Math.abs(s - n) <= threshold);
      if (!isDupe) seen.push(n);
      return !isDupe;
    });
  }

  function getSaturation(hex) {
    if (!hex || !hex.startsWith('#')) return 0;
    const r = parseInt(hex.slice(1,3), 16) / 255;
    const g = parseInt(hex.slice(3,5), 16) / 255;
    const b = parseInt(hex.slice(5,7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return 0;
    const d = max - min;
    return l > 0.5 ? d / (2 - max - min) : d / (max + min);
  }

  function rgbToHex(rgb) {
    if (!rgb || rgb === 'transparent') return null;
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function getLuminance(hex) {
    if (!hex || !hex.startsWith('#')) return 0.5;
    const r = parseInt(hex.slice(1,3), 16) / 255;
    const g = parseInt(hex.slice(3,5), 16) / 255;
    const b = parseInt(hex.slice(5,7), 16) / 255;
    const toLinear = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  }

  // ─── Button Variants ─────────────────────────────────────────────────────────

  function extractButtonVariants() {
    const variants = [];
    const seen = new Set();

    const allBtns = Array.from(document.querySelectorAll(
      'button, [class*="btn"], [role="button"], a[class*="cta"], a[class*="button"]'
    )).filter(el => {
      const s = window.getComputedStyle(el);
      return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
    });

    allBtns.forEach(btn => {
      if (variants.length >= 5) return;
      const s = window.getComputedStyle(btn);
      const bgHex = rgbToHex(s.backgroundColor);
      const colorHex = rgbToHex(s.color);
      const radius = s.borderRadius;
      const borderWidth = s.borderWidth;

      const sig = `${bgHex}|${colorHex}|${radius}`;
      if (seen.has(sig)) return;
      seen.add(sig);

      const isTransparent = !bgHex || s.backgroundColor === 'rgba(0, 0, 0, 0)';
      const hasBorder = borderWidth && borderWidth !== '0px' && s.borderStyle !== 'none';
      const isPill = parseFloat(radius) > 100;

      let type = 'primary';
      if (variants.length === 0) type = 'primary';
      else if (isTransparent && hasBorder) type = 'outline';
      else if (isTransparent) type = 'ghost';
      else if (isPill) type = 'pill';
      else type = 'secondary';

      variants.push({
        type,
        backgroundColor: bgHex || 'transparent',
        color: colorHex || s.color,
        padding: s.padding,
        borderRadius: radius,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        border: cleanBorder(s.border),
        transition: s.transition !== 'none' && s.transition !== 'all 0s ease 0s' ? s.transition : null,
        letterSpacing: s.letterSpacing !== 'normal' ? s.letterSpacing : null,
        textTransform: s.textTransform !== 'none' ? s.textTransform : null,
        boxShadow: s.boxShadow !== 'none' ? s.boxShadow : null
      });
    });

    return variants;
  }

  // ─── Interaction States ───────────────────────────────────────────────────────

  function extractInteractionStates() {
    const hover = {};
    const focus = {};
    const interesting = ['color', 'background-color', 'border-color', 'opacity', 'transform', 'box-shadow', 'text-decoration', 'outline'];

    Array.from(document.styleSheets).forEach(sheet => {
      try {
        Array.from(sheet.cssRules || []).forEach(rule => {
          const sel = rule.selectorText || '';
          if (!rule.style) return;

          const collectChanges = () => {
            const changes = {};
            interesting.forEach(prop => {
              const val = rule.style.getPropertyValue(prop);
              if (val) changes[prop] = val;
            });
            return changes;
          };

          if (sel.includes(':hover')) {
            const base = sel.replace(/:hover\b.*/g, '').trim();
            if (!hover[base] && Object.keys(hover).length < 8) {
              const ch = collectChanges();
              if (Object.keys(ch).length > 0) hover[base] = ch;
            }
          }
          if (sel.includes(':focus')) {
            const base = sel.replace(/:focus\b.*/g, '').trim();
            if (!focus[base] && Object.keys(focus).length < 6) {
              const ch = collectChanges();
              if (Object.keys(ch).length > 0) focus[base] = ch;
            }
          }
        });
      } catch(e) {}
    });

    return { hover, focus };
  }

  // ─── Message listener ────────────────────────────────────────────────────────

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extractDesign') {
      try {
        const data = extractDesignData();
        sendResponse({ success: true, data });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    }
    return true;
  });

})();
