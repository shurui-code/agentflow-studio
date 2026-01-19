// lib/groundTruth.ts - Ground Truth 和 Dataset Statistics

export const baseballGroundTruth = `
    This dataset contains performance information about two baseball players, Derek Jeter and David Justice, and their hitting data betweem 1995 and 1996. 
    This dataset has a phenonmeno called Simpson Paradox. 
    The dataset shows that David Justice has a higher batting average than Derek Jeter in both 1995 and 1996, but when the data is combined, Derek Jeter has a higher overall batting average.
    Here are the statistics for each player:
### Baseball Statistic:

Derek Jeter: 
    - Overall Hitting Rate: 0.309
    - 1995 Hitting Rate: 0.250
    - 1996 Hitting Rate: 0.314
    David Justice:
    - Overall Hitting Rate: 0.270
    - 1995 Hitting Rate: 0.253
    - 1996 Hitting Rate: 0.321
`;

export const kidneyGroundTruth = `
    This dataset contains performance information about two kidney treatment methods, A and B, and their success rates.
    The dataset shows that treatment method A has a higher success rate than treatment method B in both large kidney stone treatment and small kidney stone treatment, but when the data is combined, treatment method B has a higher overall success rate.
    Here are the statistics for each treatment method:
### Kidney Treatment Statistic: 

Treatment Method A:
    - Overall: 0.780
    - Large Stone Treatment: 0.730 
    - Small Stone Treatment: 0.931
    Treatment Method B:
    - Overall: 0.826
    - Large Stone Treatment: 0.688
    - Small Stone Treatment: 0.867
`;

export const baseballDatasetStatistic = `
### Baseball Statistic:

Derek Jeter: 
    - Overall Hitting Rate: 0.309
    - 1995 Hitting Rate: 0.250
    - 1996 Hitting Rate: 0.314
    David Justice:
    - Overall Hitting Rate: 0.270
    - 1995 Hitting Rate: 0.253
    - 1996 Hitting Rate: 0.321
    In baseball dataset, the overall hitting rate of Derek Jeter is higher than David Justice, 
    but for each year, David Justice has a higher hitting rate than Derek Jeter.
`;

export const kidneyDatasetStatistic = `
### Kidney Treatment Statistic: 

Treatment Method A:
    - Overall: 0.780
    - Large Stone Treatment: 0.730 
    - Small Stone Treatment: 0.931
    Treatment Method B:
    - Overall: 0.826
    - Large Stone Treatment: 0.688
    - Small Stone Treatment: 0.867
In kidney treatment dataset, 
the overall success rate of treatment method B is higher than treatment method A, 
but for each size of kidney stone, 
treatment method A has a higher success rate than treatment method B.
`;
