# KubeTimr

A clean speedcubing timer that does everything csTimer does, with every cube getting its own profile. There are no accounts and nothing leaves your browser.

<table>
  <tr>
    <td align="center"><img src="screenshots/img1.png" width="400" alt="Timer"/><br/><em>Timer.</em></td>
    <td align="center"><img src="screenshots/img2.png" width="400" alt="Stats"/><br/><em>Stats for the active cube.</em></td>
  </tr>
  </tr>
</table>

## How it works

There are two screens, Timer and Stats, plus a cube menu.

- **Cube profiles.** 3x3, 2x2, OH, PLL training and the rest each keep their own solves, averages and records. Pick a cube from the menu under its name and you are in that profile.
- **Timer.** Shows the scramble, the time and one line of stats. Everything else stays out of the way until you need it.
- **Guide.** The small cube in the stats line opens a 3D walkthrough. Scramble shows how to scramble the cube move by move, and Solve plays a solution move by move.
- **Stats.** Best and current for every average, a trend chart, a distribution and the full solve table.

## Features

- Hold space or touch until the timer turns green, release to start, and press any key to stop.
- WCA inspection with the +2 and DNF rules, plus spoken or beeped calls at 8 and 12 seconds.
- Split phases with CFOP, Roux, ZZ and BLD presets.
- Typing mode for times from a stackmat, where 1234 means 12.34.
- Random state scrambles for every WCA event, plus FTO, Kilominx, Redi Cube, relays and a no scramble option.
- 3x3 training sets for LL, PLL, OLL, ZBLL, COLL, 2GLL, ELL, CLL, LSLL, F2L, Easy Cross, edges only, corners only, Roux CMLL and L6E.
- Real solutions in the guide for 3x3 events, 2x2 and Pyraminx. Other puzzles play the scramble back in reverse. Square-1 and Clock have no 3D model, so they have no guide.
- Averages use WCA trimming of 5% per side, rounded up. Click any average to see its breakdown.
- csTimer import sorts each session into the matching cube profile and skips solves you already have.
- Export to csTimer, a full KubeTimr backup, or a CSV file per cube.
- Data from older KubeTimr versions migrates automatically.

## License

MIT, see [LICENSE](LICENSE).
