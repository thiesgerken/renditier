use chrono::{DateTime, Utc};
use log::{debug, trace, warn};

pub fn convert(irr: f64, reference: chrono::Duration, target: chrono::Duration) -> f64 {
    let d = reference.num_seconds() as f64 / target.num_seconds() as f64;

    f64::exp(f64::ln(1.0 + irr) / d) - 1.0
}

pub fn compute(transactions: &[(DateTime<Utc>, f64)], period: chrono::Duration) -> Option<f64> {
    let beginning = transactions.iter().map(|(d, _)| d).min()?;

    let seconds_per_interval = period.num_seconds();
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

    if transactions.is_empty() {
        return None;
    }

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

    newton(&f, &df, 0.1, 25, 1e-2, 1e-6, (-0.999_999_999, 1000.0))
}

// newton method with projection of x to >= some lower bound (e.g. -0.999_999_999 for IRR)
// stops iterating after upper bound is reached; can be set to f64::INFINITY to disable this
fn newton(
    f: &dyn Fn(f64) -> f64,
    df: &dyn Fn(f64) -> f64,
    x0: f64,
    max_iter: u32,
    eps_val: f64,
    eps_step: f64,
    bounds: (f64, f64),
) -> Option<f64> {
    let (project_lb, divergence_ub) = bounds;

    let mut n = 0;
    let mut x = x0;
    let mut fx = 0.0;
    loop {
        if n >= max_iter {
            warn!(
                "Newton unsuccessful: reached maximum iteration count; n={}, x={:0.2}, f(x)={:0.2}",
                n, x, fx
            );
            return None;
        }

        fx = f(x);
        if fx.abs() < eps_val {
            trace!(
                "success: |f(x)|={:0.2e}<{:0.2e}; n={}, x={:0.2}, f(x)={:0.2}",
                fx.abs(),
                eps_val,
                n,
                x,
                fx
            );
            break;
        }

        let dfx = df(x);
        if dfx == 0.0 {
            warn!(
                "Newton unsuccessful: reached critical point; n={}, x={:0.2}, f(x)={:0.2}",
                n, x, fx
            );
            return None;
        }

        let step = fx / dfx;
        x -= step;

        if x < project_lb {
            debug!(
                "projecting iterate to {:0.9}, n={}, x={:0.2}, f(x)={:0.2}",
                project_lb, n, x, fx
            );
            x = project_lb;
        } else if x >= divergence_ub {
            warn!(
                "Newton unsuccessful: reached upper bound; n={}, x={:0.2e}>{:0.2e}, f(x)={:0.2}",
                n, x, divergence_ub, fx
            );
            return None;
        }

        if step.abs() < eps_step {
            debug!(
                "success: |x_n-x_{{n-1}}|={:0.2e}<{:0.2e}, n={}, x_n={:0.2}, f(x_n)={:0.2}",
                step.abs(),
                eps_step,
                n,
                x,
                fx
            );
            break;
        }

        n += 1;
    }

    Some(x)
}
