(() => {
  "use strict";

  const MAX_TEXT = 5000;
  let pendingSubmissionKey = sessionStorage.getItem("saga_submission_key");

  function getValues(name) {
    return [...document.querySelectorAll(`[name="${name}"]:checked`)]
      .map((element) => element.value.trim())
      .filter(Boolean);
  }

  function getValue(name) {
    const element = document.querySelector(`[name="${name}"]`);
    if (!element) return "";

    if (element.type === "radio") {
      return document.querySelector(`[name="${name}"]:checked`)?.value?.trim() || "";
    }

    if (element.type === "checkbox") {
      return getValues(name);
    }

    return String(element.value || "").trim().slice(0, MAX_TEXT);
  }

  function collectBrief() {
    return {
      schema_version: "1.0",
      submission_key: pendingSubmissionKey || crypto.randomUUID(),
      source: "github-pages",
      client: {
        brand: getValue("brand"),
        contact: getValue("contact"),
        markets: getValues("market"),
        price_segment: getValue("price"),
      },
      product: {
        category: getValue("category"),
        first_batch_volume: getValue("volume"),
        delivery_format: getValue("format"),
      },
      sensory: {
        reference_drink: getValue("reference"),
        main_flavour: getValue("flavor"),
        mouthfeel: getValue("body"),
        sweetness: getValue("sweetness"),
        must_not_have: getValue("nogo"),
      },
      positioning: {
        target_audience: getValue("audience"),
        competitors: getValue("competitors"),
        concept_name: getValue("concept"),
      },
      technical: {
        target_abv: getValue("abv"),
        bottle_format: getValue("bottle"),
        occasion: getValue("occasion"),
        flavourings_policy: getValue("flavoring"),
        special_requirements: getValue("special"),
      },
      commercial: {
        timeline: getValue("timeline"),
        development_budget: getValue("budget"),
        comments: getValue("comments"),
      },
      page: {
        url: location.href,
        language: document.documentElement.lang || "en",
        submitted_at: new Date().toISOString(),
      },
    };
  }

  function validateBrief(brief) {
    const errors = [];

    if (!brief.client.brand) errors.push("Company / brand name is required.");
    if (!brief.client.contact) errors.push("Contact person is required.");
    if (!brief.client.markets.length) errors.push("Target market is required.");
    if (!brief.client.price_segment) errors.push("Price segment is required.");
    if (!brief.product.category) errors.push("Spirit category is required.");
    if (!brief.sensory.main_flavour) errors.push("Main flavour direction is required.");

    return errors;
  }

  function setButtonState(button, state) {
    if (!button) return;

    if (state === "sending") {
      button.disabled = true;
      button.textContent = "Sending…";
    } else if (state === "sent") {
      button.disabled = true;
      button.textContent = "✓ Brief sent";
    } else {
      button.disabled = false;
      button.textContent = "Submit Brief →";
    }
  }

  function showSuccess(projectCode) {
    const panel = document.getElementById("result-panel");
    const text = document.getElementById("result-text");

    if (text) {
      text.textContent =
        `Thank you. Your brief has been received.\n` +
        `Project ID: ${projectCode}\n\n` +
        `Saga Bevcrafts will contact you directly if clarification is needed.`;
    }

    if (panel) {
      panel.style.display = "block";
      panel.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function showError(message) {
    alert(message);
  }

  async function submitBriefToSaga() {
    const button = document.getElementById("btn-submit");
    const endpoint = window.SAGA_INTAKE_URL;

    if (!endpoint || endpoint.includes("YOUR_PROJECT_REF")) {
      showError("SAGA intake URL is not configured.");
      return;
    }

    const brief = collectBrief();
    const errors = validateBrief(brief);

    if (errors.length) {
      showError(errors.join("\n"));
      return;
    }

    pendingSubmissionKey = brief.submission_key;
    sessionStorage.setItem("saga_submission_key", pendingSubmissionKey);
    setButtonState(button, "sending");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Submission-Key": brief.submission_key,
        },
        body: JSON.stringify(brief),
        signal: controller.signal,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || `Submission failed (${response.status}).`);
      }

      showSuccess(result.project_code);
      setButtonState(button, "sent");
      sessionStorage.removeItem("saga_submission_key");
      pendingSubmissionKey = null;
    } catch (error) {
      const message =
        error?.name === "AbortError"
          ? "The request timed out. Please try again. Your retry will not create a duplicate project."
          : error?.message || "Unable to submit the brief.";

      showError(message);
      setButtonState(button, "idle");
    } finally {
      clearTimeout(timeout);
    }
  }

  window.submitBriefToSaga = submitBriefToSaga;
})();
