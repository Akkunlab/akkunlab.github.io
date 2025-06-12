/** @type {import('tailwindcss').Config} */

import daisyui from 'daisyui';

module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  daisyui: {
    themes: [
      {
        theme: {
          'primary': '#0015ca',
          'primary-content': '#fff',
          'neutral': '#000',
          'neutral-content': '#fff',
          'base-200': '#e5e7eb',
          'base-300': '#0a0a0a',
        },
      },
    ],
  },
  theme: {
    fontFamily: {
      'body': ['Noto Sans JP', 'sans-serif'],
    },
    extend: {
      colors: {
        'button-active': '#1f1f1f',
        'button-active-content': '#f2f2f2',
        'button-border': 'rgba(255, 255, 255, 0.35)',
        'header-bg': 'rgba(0, 0, 0, 0.7)',
        'header-border': 'rgba(255, 255, 255, 0.1)',
        'header-hover': 'rgba(255, 255, 255, 0.1)',
        'footer-bg': '#080b14',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(120%)' },
          '100%': { transform: 'translateX(0%)' }
        },
        slideOutLeft: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-120%)' }
        },
        fadeIn: {
          from: { opacity: 0 },
          to: { opacity: 1 }
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        fadeOut: {
          from: { opacity: 1 },
          to: { opacity: 0 }
        },
        carousel: {
          '0%, 45%': { transform: 'translateX(0)', clipPath: 'inset(0 0 0 0)', opacity: 1 },
          '55%': { transform: 'translateX(-10%)', opacity: 1, clipPath: 'inset(0 100% 0 0)' },
          '55.001%, 100%': { transform: 'translateX(0%)', opacity: 0 },
        },
        textReveal: {
          '0%': { visibility: 'hidden', clipPath: 'inset(0 100% 0 0)' },
          '100%': { visibility: 'visible', clipPath: 'inset(0 0 0 0)' }
        },
        imageCurtain: {
          '0%': { transform: 'translateX(-100%)' },
          '50%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        scan: {
          '0%': { transform: 'translateY(0)', opacity: '0.5' },
          '50%': { opacity: '0.1' },
          '100%': { transform: 'translateY(100px)', opacity: '0.5' }
        },
        glitch: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        blinkCaret: {
          '0%, 100%': { borderColor: 'transparent' },
          '50%': { borderColor: 'rgba(34, 211, 238, 0.7)' }
        },
        expandWidth: {
          from: { width: '0' },
          to: { width: '100%' }
        },
        glowPulse: {
          '0%, 100%': { 
            filter: 'drop-shadow(0 0 3px rgba(34,211,238,0.2))',
            textShadow: '0 0 6px rgba(34,211,238,0.15), 0 0 12px rgba(34,211,238,0.1), 0 0 18px rgba(34,211,238,0.05)'
          },
          '50%': { 
            filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.6))',
            textShadow: '0 0 20px rgba(34,211,238,0.4), 0 0 40px rgba(34,211,238,0.3), 0 0 60px rgba(34,211,238,0.2)'
          }
        },
        fadeInUpGlow: {
          '0%': { 
            opacity: '0', 
            transform: 'translateY(20px)',
            filter: 'none',
            textShadow: 'none'
          },
          '100%': { 
            opacity: '1', 
            transform: 'translateY(0)',
            filter: 'none',
            textShadow: 'none'
          }
        },
        glowStart: {
          '0%': { 
            filter: 'none',
            textShadow: 'none'
          },
          '100%': { 
            filter: 'drop-shadow(0 0 3px rgba(34,211,238,0.2))',
            textShadow: '0 0 6px rgba(34,211,238,0.15), 0 0 12px rgba(34,211,238,0.1), 0 0 18px rgba(34,211,238,0.05)'
          }
        },
        scanLine: {
          '0%, 100%': {
            transform: 'translateY(-100%)',
            opacity: '0'
          },
          '50%': {
            transform: 'translateY(100vh)',
            opacity: '1'
          }
        },
        dataFlow: {
          '0%, 100%': {
            opacity: '0.3',
            transform: 'scale(0.8)'
          },
          '50%': {
            opacity: '1',
            transform: 'scale(1.2)',
            boxShadow: '0 0 10px currentColor'
          }
        },
        glow: {
          '0%, 100%': {
            boxShadow: '0 0 5px currentColor, 0 0 10px currentColor',
            opacity: '0.7'
          },
          '50%': {
            boxShadow: '0 0 20px currentColor, 0 0 30px currentColor',
            opacity: '1'
          }
        },
        bounce: {
          '0%, 20%, 53%, 80%, 100%': {
            transform: 'translateY(0px)'
          },
          '40%, 43%': {
            transform: 'translateY(-15px)'
          },
          '70%': {
            transform: 'translateY(-7px)'
          },
          '90%': {
            transform: 'translateY(-3px)'
          }
        },
        circleExpand: {
          '0%': {
            transform: 'scale(0)',
            opacity: '0.8'
          },
          '50%': {
            opacity: '0.9'
          },
          '100%': {
            transform: 'scale(150)',
            opacity: '1'
          }
        },
      },
      animation: {
        slideInOut: 'slideInRight 1.8s cubic-bezier(0.18, 0.9, 0.18, 0.9) forwards,' +
                    'slideOutLeft 1.8s cubic-bezier(0.18, 0.9, 0.18, 0.9) 1.8s forwards',
        fadeIn: 'fadeIn 0.5s ease-out forwards',
        fadeInUp: 'fadeInUp 0.8s cubic-bezier(0.25, 0.1, 0.25, 1) forwards',
        fadeOut: 'fadeOut 1.5s ease-out forwards',
        carousel: 'carousel 14s cubic-bezier(0.77, 0, 0.18, 1) infinite',
        textReveal: 'textReveal 1s cubic-bezier(0.77, 0, 0.18, 1) forwards',
        imageCurtain: 'imageCurtain 1.8s cubic-bezier(0.77, 0, 0.18, 1) forwards',
        imageFadeIn: 'fadeIn 1.8s cubic-bezier(0.77, 0, 0.18, 1) forwards',
        scan: 'scan 1.5s linear infinite',
        glitch: 'glitch 1.5s linear infinite',
        typing: 'expandWidth 2s steps(40, end), blinkCaret 0.75s step-end infinite',
        expandWidth: 'expandWidth 1.8s ease-out forwards',
        fadeInUpGlow: 'fadeInUpGlow 0.6s ease-out forwards, glowStart 0.3s ease-out 1.5s forwards, glowPulse 4s ease-in-out 2s infinite',
        glowPulse: 'glowPulse 4s ease-in-out infinite',
        glowStart: 'glowStart 0.5s ease-out forwards',
        scanLine: 'scanLine 2s ease-in-out infinite',
        dataFlow: 'dataFlow 1.5s ease-in-out infinite',
        glow: 'glow 2s ease-in-out infinite',
        bounce: 'bounce 2s infinite',
        circleExpand: 'circleExpand 1s cubic-bezier(0.77, 0, 0.18, 1) forwards',
      }
    }
  },
  plugins: [
    daisyui,
    function({ addBase }) {
      addBase({
        '::selection': {
          backgroundColor: '#0015ca',
          color: '#ffffff',
        },
        '::-moz-selection': {
          backgroundColor: '#0015ca',
          color: '#ffffff',
        },
      })
    },
  ],
}
