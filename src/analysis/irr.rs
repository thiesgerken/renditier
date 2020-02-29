use chrono::{DateTime, Utc};
use log::{debug, warn};

pub fn compute(transactions: &[(DateTime<Utc>, f64)]) -> Option<f64> {
    let beginning = transactions.iter().map(|(d, _)| d).min()?;

    let seconds_per_interval = chrono::Duration::days(365).num_seconds();
    let transactions = transactions
        .iter()
        .map(|(d, x)| {
            (
                d.signed_duration_since(*beginning).num_seconds() as f64
                    / seconds_per_interval as f64,
                *x,
            )
        })
        .collect::<Vec<_>>();

    let f = |x: f64| {
        transactions
            .iter()
            .fold(0.0, |acc, (t, y)| acc + y * (1.0 + x).powf(-t))
    };
    let df = |x: f64| {
        transactions
            .iter()
            .fold(0.0, |acc, (t, y)| acc - t * y * (1.0 + x).powf(-t - 1.0))
    };

    newton(&f, &df, 0.1, 25, 1e-2, 1e-6, -0.999_999_999)
}

// newton method with projection of x to >= some lower bound (e.g. -0.999_999_999 for IRR)
fn newton(
    f: &dyn Fn(f64) -> f64,
    df: &dyn Fn(f64) -> f64,
    x0: f64,
    max_iter: u32,
    eps_val: f64,
    eps_step: f64,
    project_lb: f64,
) -> Option<f64> {
    let mut n = 0;
    let mut x = x0;
    let mut fx = 0.0;
    loop {
        if n >= max_iter {
            warn!(
                "newton: maximum iteration count of {} reached; x={:0.2}, f(x)={:0.2}",
                n, x, fx
            );
            return None;
        }

        fx = f(x);
        if fx.abs() < eps_val {
            debug!("newton: |f(x)|<{:0.2e} after {} iterations", eps_val, n);
            break;
        }

        let dfx = df(x);
        if dfx == 0.0 {
            warn!(
                "newton: reached critical point after {} iterations; x={:0.2}, f(x)={:0.2}",
                n, x, fx
            );
            return None;
        }

        let step = fx / dfx;
        x -= step;

        if x < project_lb {
            debug!("newton: projecting iterate to {:0.4}", project_lb);
            x = project_lb;
        }

        if step.abs() < eps_step {
            debug!(
                "newton: |x_n-x_{{n-1}}|<{:0.2e} after {} iterations, f(x_n)={:0.2}",
                eps_step, n, fx
            );
            break;
        }

        n += 1;
    }

    Some(x)
}
