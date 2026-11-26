# How much of NGC 3198’s rotation can its stars and gas explain?

At 44.08 kiloparsecs from the center of the spiral galaxy NGC 3198, SPARC reports a circular speed of **149 ± 3 km/s**. With the authors’ Newtonian mass models and a stellar disk mass-to-light ratio of 0.5, stars and gas account for **64.71 km/s**. This measures how much additional gravity a model of the galaxy must explain. The composition of dark matter remains open. [SPARC data](https://astroweb.case.edu/SPARC/) · [Lelli, McGaugh and Schombert, equation 2](https://arxiv.org/pdf/1606.09251)

## Reproduce the comparison

From this folder, run the checker with Python 3 and internet access.

```sh
python3 check.py
```

It downloads the SPARC team’s 175-galaxy archive, checks its SHA-256, and reads `NGC3198_rotmod.dat` in memory. You can also supply a downloaded copy with `--archive /path/to/Rotmod_LTG.zip`. The archive digest is `0a80cc90714828cc28b7dd57923576714d209f2490328c087c4a4ad607faf588`. The SPARC team hosts the data and credits the original rotation-curve observations in Table 1 under Da06, Be91 and Be87. [Data archive](https://astroweb.case.edu/SPARC/Rotmod_LTG.zip) · [Table 1 and original references](https://astroweb.case.edu/SPARC/SPARC_Lelli2016c.mrt)

The table contains 43 measured radii for NGC 3198. Define the outer region before comparing speeds as all measurements at or beyond half the last measured radius. That selects 12 points from 22.12 to 44.08 kpc. Each point gets equal weight. The disk and bulge ratios are in solar units at a wavelength of 3.6 microns. We hold the bulge ratio at 0.7. The cataloged bulge contribution is zero for this galaxy.

| Assumed disk mass-to-light ratio | Median observed minus predicted speed across the 12 outer radii |
| ---: | ---: |
| 0.3 | 88.47 km/s |
| 0.5 | 79.71 km/s |
| 0.8 | 69.05 km/s |

To check the last point by hand, Table 2 gives a gas contribution of 47.84 km/s and a stellar disk contribution of 61.63 km/s at unit mass-to-light ratio. Then `sqrt(47.84² + 0.5 × 61.63²) = 64.71 km/s`. At other radii a component can pull outwards. The checker uses the signed square `v × |v|` for each component, following the authors. [SPARC Table 2](https://astroweb.case.edu/SPARC/MassModels_Lelli2016c.mrt)

## Next contribution

Repeat the comparison for NGC 2403 with `python3 check.py --galaxy NGC2403`. Use an independent calculation on Table 2 to recover its outermost speed prediction and median difference. Report the row count, radial range, all three mass-to-light assumptions, and whether the discrepancy persists. A second analysis can vary the assumed distance and inclination, which the starter holds at the catalog values.

The quoted ±3 km/s is the published uncertainty on the **observed speed** at the last radius. The sensitivity table varies one assumption. Estimating uncertainty on the gravity discrepancy also requires distance, inclination, and stellar and gas mass uncertainties. A rotation curve constrains the gravitational field, while identifying a dark matter particle requires other evidence. [SPARC methods](https://arxiv.org/abs/1606.09251) · [NASA’s overview of dark matter](https://science.nasa.gov/dark-matter/)
