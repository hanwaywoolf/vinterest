(function () {
  const TWEAK_DEFAULTS = {
    "layout": localStorage.getItem('vinterest_force_mobile') === '1' ? 'Phone' : 'Tablet',
    "scanCards": {
      'deck': 'Swipe deck',
      'carousel': 'Carousel',
      'feed': 'Feed'
    }[localStorage.getItem('vinterest_scancard_style') || 'deck']
  };
  function VinterestTweaks() {
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    React.useEffect(() => {
      const isMobile = t.layout === 'Phone';
      const current = localStorage.getItem('vinterest_force_mobile') === '1';
      if (isMobile !== current) {
        if (isMobile) localStorage.setItem('vinterest_force_mobile', '1');else localStorage.removeItem('vinterest_force_mobile');
        location.reload();
      }
    }, [t.layout]);
    React.useEffect(() => {
      const map = {
        'Swipe deck': 'deck',
        'Carousel': 'carousel',
        'Feed': 'feed'
      };
      const next = map[t.scanCards] || 'deck';
      if (next !== (localStorage.getItem('vinterest_scancard_style') || 'deck')) {
        localStorage.setItem('vinterest_scancard_style', next);
        window.dispatchEvent(new Event('vinterest:scancardstyle'));
      }
    }, [t.scanCards]);
    return /*#__PURE__*/React.createElement(TweaksPanel, null, /*#__PURE__*/React.createElement(TweakSection, {
      label: "Preview"
    }), /*#__PURE__*/React.createElement(TweakRadio, {
      label: "Layout",
      value: t.layout,
      options: ['Phone', 'Tablet'],
      onChange: v => setTweak('layout', v)
    }), /*#__PURE__*/React.createElement(TweakSection, {
      label: "Scan results"
    }), /*#__PURE__*/React.createElement(TweakRadio, {
      label: "Card style",
      value: t.scanCards,
      options: ['Swipe deck', 'Carousel', 'Feed'],
      onChange: v => setTweak('scanCards', v)
    }));
  }
  const tweaksRoot = ReactDOM.createRoot(document.getElementById('tweaks-root'));
  tweaksRoot.render(React.createElement(VinterestTweaks));
})();