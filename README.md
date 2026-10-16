# Next Step Tri-Valley

**Live site:** https://abhinavjag.github.io/next-step-tri-valley/

A free tool for workers in Dublin, Pleasanton and Livermore, California. Type in your job and you'll see:

- **How exposed it is to AI**, as a 0 to 100 score you can compare with other jobs
- **What it pays here**, using federal wage data for our metro area
- **Jobs that use the skills you already have**, plus moves toward jobs that are less exposed and still pay close to what you make now
- **Where to train nearby**, matched to programs at Las Positas College in Livermore
- **Free help**, like the Tri-Valley Career Center and California Training Benefits

It also has an **unemployment estimate** that uses EDD's benefit table, and a **For the city** page that shows local officials which workers are most exposed and what a small reskilling pilot would cover.

Everything runs in your browser. There's no account, no tracking, and nothing you type is sent anywhere.

Built for Neighborhood Hacks 2026.

## Why I built it

My research paper, *The Safety Net Was Not Built for This* (NHSJS, 2026), found that office and administrative jobs are among the most exposed to AI and also among the lowest paid. When those workers get laid off, unemployment in California tops out at $450 a week and doesn't pay for a new skill. I proposed a $40,000 reskilling voucher pilot to the Dublin City Council. This tool is the part a worker can use today: it shows them where they could go next and how to get there without leaving the Tri-Valley.

## Data

| What | Source | File |
|---|---|---|
| Pay and job counts | BLS Occupational Employment and Wage Statistics, May 2025, San Francisco-Oakland-Fremont, CA metro area (41860) | `data/raw/oews_may2025_sf_msa_and_soc_crosswalk.txt` |
| SOC 2010 to 2018 job code crosswalk | BLS | same file, second section |
| AI exposure | AI Occupational Exposure (AIOE) scores, Felten, Raj and Seamans (2021), [github.com/AIOE-Data/AIOE](https://github.com/AIOE-Data/AIOE) | downloaded by the pipeline |
| Related jobs and preparation level | O*NET 30.3 Related Occupations and Job Zones | `data/raw/onet_related_30_3.txt` |
| Local training and help | Las Positas College 2024-2025 catalog and Continuing Education page; Tri-Valley Career Center; EDD | `data/training.json` |
| Unemployment estimate | EDD benefit table DE 1101BT5 (claims since 2005) | in `docs/app.js` |

The two raw text files are compact extracts made in the browser from the official BLS and O*NET downloads:

- **OEWS file:** one line per detailed occupation, `soc|title|tot_emp|a_pct10|a_pct25|a_median|a_pct75|a_pct90`, then `soc2010|soc2018` for crosswalk rows where the code changed.
- **O*NET file:** three parts split by `|`. First, the list of 6-digit job codes. Second, for each code, up to 8 related jobs in O*NET's order, written as base-36 positions in that list and separated by `.`. Third, one Job Zone digit per code.

## How it works

`pipeline/build_data.py` joins the three datasets and writes `docs/data.json`, which the site loads.

1. **AI exposure.** Jobs with the same code in both job-code versions match directly (566 jobs). Jobs whose code changed in 2018 get the average score of their old codes using the BLS crosswalk (83 jobs). 52 jobs can't be matched and are left out. The score becomes a percentile across all jobs, so 80 means more exposed than 80% of jobs. High is the top third.
2. **Moves toward less exposure.** Among jobs one or two O*NET "related" steps away, keep jobs that are at least 10 points less exposed, pay at least 85% of your current local median, need at most one more level of preparation, and have at least 1,000 local jobs. Closer jobs come first, then higher pay.
3. **Training.** Each program in `data/training.json` lists the job codes it leads to. A job's page shows programs for the job itself, its related jobs, and its moves.

To rebuild the data:

```
pip install openpyxl
python3 pipeline/build_data.py
```

To run the site locally, serve the `docs` folder, for example `python3 -m http.server -d docs`.

## Limitations

- Exposure isn't a prediction of job loss. It measures how much a job's required abilities overlap with what AI can do.
- The AIOE scores are from 2021 and use the older 2010 job list.
- BLS doesn't publish wages for the Tri-Valley alone, so pay covers the whole metro area, including San Francisco and Oakland.
- Program lists change, so check with Las Positas College before enrolling.

## AI disclosure

I used Claude, an AI assistant from Anthropic, to help write the code, collect and process the public data, and draft the text on the site. I chose the idea, the features and the local resources, and I checked the results.
