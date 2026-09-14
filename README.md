```text
             _  .-')      ('-.      ('-.      _ (`-.                  .-')    
            ( \( -O )   _(  OO)   _(  OO)    ( (OO  )                ( OO ).  
   .-----.   ,------.  (,------. (,------.  _.`     \          ,--. (_)---\_) 
  '  .--./   |   /`. '  |  .---'  |  .---' (__...--''      .-')| ,| /    _ |  
  |  |('-.   |  /  | |  |  |      |  |      |  /  | |     ( OO |(_| \  :` `.  
 /_) |OO  )  |  |_.' | (|  '--.  (|  '--.   |  |_.' |     | `-'|  |  '..`''.) 
 ||  |`-'|   |  .  '.'  |  .--'   |  .--'   |  .___.'     ,--. |  | .-._)   \ 
(_'  '--'\   |  |\  \   |  `---.  |  `---.  |  |      .-. |  '-'  / \       / 
   `-----'   `--' '--'  `------'  `------'  `--'      `-'  `-----'   `-----'
```

# CREEP.JS

A modern recreation of an old-school JavaScript/DHTML effect where the letters on a webpage slowly **creep away** when the user goes idle.

Instead of the page simply disappearing, individual letters quietly begin floating away as if little ghosts are stealing the website one piece at a time. Images can also flicker, drift away, rotate, and disappear.

As soon as the user moves the mouse, presses a key, scrolls, or otherwise interacts with the page, everything quickly rushes back into place.

No special markup is required. Add the script to your page and let it do the rest.

---

## 👻 What Does It Do?

After the visitor has been inactive for a configurable amount of time:

* Individual letters begin creeping away from their original positions.
* Letters leave in random groups at random intervals.
* Each letter chooses its own direction, distance, rotation, speed, and fade point.
* Some letters disappear before reaching the edge of the screen.
* Images begin flickering and appear to be carried away by invisible ghosts.
* Moving images escape their original containers, so they aren't clipped by parent elements.
* Activity immediately causes everything to rush back into place.
* The original page layout remains intact throughout the effect.

The result is meant to feel subtle at first. You might notice a letter missing here... another floating away over there... and eventually realize the website itself is disappearing.

---

## 📦 Installation

Download `creep.js` and add it near the bottom of your page, just before the closing `</body>` tag:

```html
<script src="creep.js"></script>
</body>
```

That's it.

CREEP.JS automatically finds the visible text and images on the page.

You do **not** need to wrap your text in special elements or assign IDs/classes for the effect to work.

---

## ⚙️ Configuration

All of the main settings are located near the top of `creep.js` inside:

```js
const SETTINGS = {
    // ...
};
```

### Idle Time

```js
idleTime: 7000,
```

How long the visitor must remain inactive before the haunting begins.

The value is in milliseconds.

`7000` = 7 seconds.

---

## 👻 Letter Movement

```js
maxActiveLetters: 1500,
maxLettersPerInterval: 30,

letterStartGapMin: 500,
letterStartGapMax: 1500,

minTravelTime: 10000,
maxTravelTime: 22000,

maxRotation: 127,
```

### `maxActiveLetters`

Maximum number of letters that are allowed to be actively creeping away at the same time.

### `maxLettersPerInterval`

Maximum number of new letters that can begin moving during each interval.

The actual amount is randomized between `1` and this number.

For example:

```js
maxLettersPerInterval: 4,
```

could result in:

```text
Interval 1 → 1 letter
Interval 2 → 4 letters
Interval 3 → 2 letters
Interval 4 → 3 letters
```

This helps prevent the effect from looking synchronized.

### `letterStartGapMin` / `letterStartGapMax`

Controls the random delay between groups of departing letters.

```js
letterStartGapMin: 500,
letterStartGapMax: 1500,
```

means another group will begin somewhere between 0.5 and 1.5 seconds later.

### `minTravelTime` / `maxTravelTime`

Controls how slowly or quickly each letter floats away.

Each letter receives its own random travel time within this range.

---

## 🌫️ Letter Distance & Fading

```js
minTravelFraction: 0.35,
maxTravelFraction: 1.00,
fullEdgeChance: 0.18,

minFadeFraction: 0.25,
maxFadeFraction: 0.78,
```

Not every letter has to fly completely off the screen.

### `minTravelFraction`

Minimum percentage of the journey toward the selected edge.

```js
0.35
```

means approximately 35%.

### `maxTravelFraction`

Maximum possible travel distance.

```js
1.00
```

allows a letter to travel the full distance.

### `fullEdgeChance`

Chance that a letter deliberately travels all the way to the edge.

```js
0.18
```

means an 18% chance.

### `minFadeFraction` / `maxFadeFraction`

Controls when a letter becomes completely invisible during its journey.

This allows letters to quietly vanish before reaching the edge rather than having every character visibly fly off-screen.

---

## 🖼️ Haunted Images

Images can also participate in the effect.

```js
imageEffectEnabled: true,

imageStartDelayMin: 3000,
imageStartDelayMax: 5000,

imageStaggerMin: 1000,
imageStaggerMax: 2000,

imageFlickerMin: 6,
imageFlickerMax: 10,

imageFlickerStepMin: 50,
imageFlickerStepMax: 200,

imageFadeTimeMin: 200,
imageFadeTimeMax: 800,
```

Images begin a few seconds after the letters start disappearing.

Each image flickers several times before fading away.

Images are processed in a randomized order so the effect doesn't look scripted or predictable.

---

## 👻 Image Movement

```js
imageMoveEnabled: true,

imageMoveDistanceMin: 180,
imageMoveDistanceMax: 620,

imageMoveTimeMin: 4500,
imageMoveTimeMax: 7000,

imageMoveRotationMax: 143,
```

When enabled, images don't simply fade out.

They begin drifting away from their original positions while flickering, giving the impression that something invisible is carrying them away.

Each image receives randomized:

* Direction
* Distance
* Movement time
* Rotation
* Flickering
* Fade timing

Moving images are temporarily copied into CREEP.JS's full-screen overlay. This allows them to escape containers that use CSS such as:

```css
overflow: hidden;
```

without being chopped off at the container boundary.

The original image remains in place invisibly so the page layout doesn't collapse.

---

## 🚫 Excluding Parts of the Page

Sometimes there are areas you don't want CREEP.JS touching.

Add:

```html
data-no-creep
```

to any element:

```html
<div data-no-creep>
    This entire section will be ignored.
</div>
```

Everything inside that element is ignored as well.

You can also add selectors directly to the configuration:

```js
ignoreSelectors: [
    'script',
    'style',
    'noscript',
    'template',
    'textarea',
    'input',
    'select',
    'option',
    'button',
    'code',
    'pre',
    '[contenteditable="true"]',
    '[data-no-creep]'
]
```

IDs and classes can be added too:

```js
'#header',
'#footer',
'.navigation',
'.copyright'
```

---

## 🖼️ Excluding Only an Image

If you want the surrounding content to creep but want a particular image left alone, add:

```html
data-no-creep-image
```

Example:

```html
<img src="logo.png" alt="Logo" data-no-creep-image>
```

That image will not flicker, move, or disappear.

---

## 🖱️ Activity Detection

CREEP.JS watches for normal visitor activity, including:

* Mouse movement
* Mouse clicks
* Keyboard input
* Touch input
* Pointer input
* Mouse wheel
* Scrolling

The moment activity is detected, the haunting stops.

Letters rush back to their exact original positions and disappearing images return.

---

## 🧠 How It Works

CREEP.JS does **not** permanently split all of your page text into hundreds of `<span>` elements.

The normal page remains untouched while the visitor is active.

When the idle effect begins, CREEP.JS measures the browser-rendered position of each visible character and creates temporary copies inside a full-screen overlay.

The original text is temporarily made transparent while maintaining its normal layout.

The copies are then independently animated.

Images use a similar technique. A temporary image copy can move freely inside the full-screen overlay while the original image continues holding its place in the document.

When activity resumes, everything returns to its starting position, the temporary overlay is removed, and the original page becomes visible again.

This allows CREEP.JS to create the effect without permanently altering the page's normal typography or layout.

---

## 🕸️ Why CREEP.JS?

This project was inspired by an old JavaScript/DHTML effect from the early days of the web.

The original script caused letters on a webpage to slowly creep away after the visitor had been inactive for a while. It was one of those strange little effects that fit perfectly into the experimental websites of the late 1990s and early 2000s.

After searching for the old script years later and being unable to find the version I remembered, I decided to recreate the effect for modern browsers.

The goal wasn't to create a modern particle system.

It was to recreate that old feeling:

> You're looking at a perfectly normal webpage... until you realize the letters are quietly leaving.

The image effects were added later to take the idea further, making it look as though ghosts are slowly stealing the entire website.

---

## 🌐 Browser Support

CREEP.JS is written for modern web browsers and uses standard browser APIs including:

* DOM
* CSS transitions
* `Range`
* `getClientRects()`
* `getBoundingClientRect()`
* `TreeWalker`
* `requestAnimationFrame`-style browser rendering behavior

It does not require jQuery or another JavaScript framework.

---

## 📁 Files

```text
creep.js
README.md
```

Only `creep.js` is required to use the effect.

---

## 🔧 Dependencies

None.

CREEP.JS is plain JavaScript.

No:

* jQuery
* npm
* Node.js
* CSS framework
* External libraries
* Build process

Just include the script and go.

---

## ⚠️ Notes

CREEP.JS creates temporary visual copies of visible characters while the effect is active. Pages containing extremely large amounts of visible text may therefore require more browser resources while the effect is running.

The script is intended primarily as a fun visual effect, Easter egg, Halloween effect, horror-themed website feature, or nostalgic tribute to the weird old web.

---

## 👨‍💻 Author

Created by **coRpSE**

A recreation and expansion of the classic creeping-text DHTML effect for modern browsers.

---

## 📜 License

Add your chosen license information here.

For example, if releasing under the MIT License:

```text
MIT License
```

See the `LICENSE` file for details.

---

## 👻 One Last Warning...

Leave the page alone long enough...

...and it may not be there when you get back.
