document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  const example = {
    elements: [
      { symbol: "Nb", ratio: 2, mass: 92.906, density: 8.57 },
      { symbol: "Co", ratio: 2, mass: 58.933, density: 8.90 },
      { symbol: "In", ratio: 1, mass: 114.818, density: 7.31 },
      { symbol: "Sb", ratio: 1, mass: 121.760, density: 6.68 }
    ],
    sampleMass: 5,
    dieDiameter: 1.27
  };

  function select(selector) {
    return document.querySelector(selector);
  }

  const rows = select("#elementRows");
  const template = select("#element-template");
  const result = select("#result");
  const error = select("#error");

  function getToday() {
    const date = new Date();
    const localDate = new Date(
      date - date.getTimezoneOffset() * 60000
    );

    return localDate.toISOString().slice(0, 10);
  }

  function format(value) {
    return Number(value).toFixed(6);
  }

  function escapeHtml(value) {
    const characters = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };

    return String(value).replace(/[&<>"']/g, function (character) {
      return characters[character];
    });
  }

  function updateElementNumbers() {
    const elementRows = rows.children;

    Array.from(elementRows).forEach(function (row, index) {
      row.querySelector(".element-number").textContent =
        "Element " + (index + 1);
    });
  }

  function addElement(data) {
    const elementData = data || {};
    const row = template.content.firstElementChild.cloneNode(true);

    row.querySelector(".symbol").value =
      elementData.symbol || "";

    row.querySelector(".ratio").value =
      elementData.ratio ?? "";

    row.querySelector(".mass").value =
      elementData.mass ?? "";

    row.querySelector(".density").value =
      elementData.density ?? "";

    row.querySelector(".remove").addEventListener(
      "click",
      function () {
        row.remove();
        updateElementNumbers();
      }
    );

    rows.appendChild(row);
    updateElementNumbers();
  }

  function readElements() {
    const elementRows = rows.querySelectorAll(".element-row");

    return Array.from(elementRows).map(function (row) {
      return {
        symbol: row.querySelector(".symbol").value.trim(),

        ratio: Number(
          row.querySelector(".ratio").value
        ),

        mass: Number(
          row.querySelector(".mass").value
        ),

        density: Number(
          row.querySelector(".density").value
        )
      };
    });
  }

  function readInput() {
    return {
      operator: select("#operator").value.trim(),
      sample: select("#sample").value.trim(),
      date: select("#date").value,

      sampleMass: Number(
        select("#sampleMass").value
      ),

      dieDiameter: Number(
        select("#dieDiameter").value
      ),

      elements: readElements()
    };
  }

  function validateInput(input) {
    if (input.elements.length === 0) {
      throw new Error("Add at least one element.");
    }

    if (input.sampleMass <= 0) {
      throw new Error(
        "Sample mass must be greater than zero."
      );
    }

    if (input.dieDiameter <= 0) {
      throw new Error(
        "Die diameter must be greater than zero."
      );
    }

    input.elements.forEach(function (element, index) {
      const elementNumber = index + 1;

      if (!element.symbol) {
        throw new Error(
          "Element " + elementNumber + ": enter a symbol."
        );
      }

      if (element.ratio <= 0) {
        throw new Error(
          "Element " + elementNumber +
          ": ratio must be positive."
        );
      }

      if (element.mass <= 0) {
        throw new Error(
          "Element " + elementNumber +
          ": atomic mass must be positive."
        );
      }

      if (element.density <= 0) {
        throw new Error(
          "Element " + elementNumber +
          ": density must be positive."
        );
      }
    });
  }

  function calculate(input) {
    const elements = input.elements;

    const totalMass = elements.reduce(
      function (total, element) {
        return total + element.ratio * element.mass;
      },
      0
    );

    const weightFractions = elements.map(
      function (element) {
        return (
          element.ratio * element.mass
        ) / totalMass;
      }
    );

    const inverseDensity = elements.reduce(
      function (total, element, index) {
        return (
          total +
          weightFractions[index] / element.density
        );
      },
      0
    );

    const theoreticalDensity = 1 / inverseDensity;

    const dieArea =
      Math.PI *
      Math.pow(input.dieDiameter / 2, 2);

    const sampleHeight =
      (
        input.sampleMass /
        (dieArea * theoreticalDensity)
      ) * 10;

    const formula = elements.map(
      function (element) {
        if (element.ratio === 1) {
          return element.symbol;
        }

        return element.symbol + element.ratio;
      }
    ).join("");

    return {
      formula: formula,
      totalMass: totalMass,
      weightFractions: weightFractions,
      theoreticalDensity: theoreticalDensity,
      dieArea: dieArea,
      sampleHeight: sampleHeight
    };
  }

  function renderReport(input, values) {
    const compositionRows = input.elements.map(
      function (element, index) {
        return `
          <tr>
            <td>${escapeHtml(element.symbol)}</td>
            <td>${element.ratio}</td>
            <td>${format(values.weightFractions[index])}</td>
            <td>${format(element.mass)} g/mol</td>
            <td>${format(element.density)} g/cm³</td>
          </tr>
        `;
      }
    ).join("");

    result.innerHTML = `
      <div class="report-head">
        <div>
          <span>INTERMETALLIC ALLOY REPORT</span>
          <h2>${escapeHtml(values.formula)}</h2>
        </div>
        <div class="report-mark">IA</div>
      </div>

      <div class="meta">
        <div>
          <span>Operator</span>
          <b>
            ${escapeHtml(input.operator || "Not specified")}
          </b>
        </div>

        <div>
          <span>Sample</span>
          <b>
            ${escapeHtml(input.sample || values.formula)}
          </b>
        </div>

        <div>
          <span>Date</span>
          <b>
            ${escapeHtml(input.date || "Not specified")}
          </b>
        </div>

        <div>
          <span>Formula</span>
          <b>${escapeHtml(values.formula)}</b>
        </div>
      </div>

      <h3>Composition details</h3>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Element</th>
              <th>Ratio</th>
              <th>Weight fraction</th>
              <th>Atomic mass</th>
              <th>Density</th>
            </tr>
          </thead>

          <tbody>
            ${compositionRows}
          </tbody>
        </table>
      </div>

      <h3>Calculation results</h3>

      <div class="totals">
        <div>
          <span>Total atomic mass</span>
          <b>${format(values.totalMass)} g/mol</b>
        </div>

        <div>
          <span>Theoretical density</span>
          <b>
            ${format(values.theoreticalDensity)} g/cm³
          </b>
        </div>

        <div class="grand">
          <span>Sample height</span>
          <b>${format(values.sampleHeight)} mm</b>
        </div>
      </div>

      <h3>Sample and die information</h3>

      <div class="table-wrap">
        <table>
          <tbody>
            <tr>
              <td>Sample mass</td>
              <td>${format(input.sampleMass)} g</td>
            </tr>

            <tr>
              <td>Die diameter</td>
              <td>${format(input.dieDiameter)} cm</td>
            </tr>

            <tr>
              <td>Die area</td>
              <td>${format(values.dieArea)} cm²</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="notice">
        <b>Calculation method</b>
        <p>
          Theoretical density uses
          1 / ρ = Σ(wᵢ / ρᵢ).
          Sample height uses mass / (area × density).
        </p>
      </div>

      <div class="warning">
        <b>Assumptions used</b>
        <ol>
          <li>The alloy is treated as fully dense with no porosity.</li>
          <li>Elemental densities are supplied by the user.</li>
          <li>The sample is treated as a cylinder.</li>
          <li>Die diameter is entered in centimetres.</li>
          <li>Height is reported in millimetres.</li>
        </ol>
      </div>

      <p class="credit">
        Created by <b>Latif</b> for the <b>Muath Group</b>.
      </p>

      <div class="report-actions">
        <button id="print" type="button">
          Print / Save report as PDF
        </button>

        <button id="edit" class="secondary" type="button">
          Return to calculator
        </button>
      </div>
    `;

    result.hidden = false;

    select("#print").addEventListener(
      "click",
      function () {
        window.print();
      }
    );

    select("#edit").addEventListener(
      "click",
      function () {
        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });
      }
    );

    result.scrollIntoView({
      behavior: "smooth"
    });
  }

  function createReport() {
    error.textContent = "";

    try {
      const input = readInput();

      validateInput(input);

      const calculatedValues = calculate(input);

      renderReport(input, calculatedValues);
    } catch (problem) {
      result.hidden = true;
      error.textContent = problem.message;
    }
  }

  function loadExample() {
    rows.replaceChildren();

    select("#operator").value =
      "Example Operator";

    select("#sample").value =
      "Nb₂Co₂InSb";

    select("#date").value =
      getToday();

    select("#sampleMass").value =
      example.sampleMass;

    select("#dieDiameter").value =
      example.dieDiameter;

    example.elements.forEach(function (element) {
      addElement(element);
    });

    createReport();
  }

  function clearForm() {
    rows.replaceChildren();

    select("#operator").value = "";
    select("#sample").value = "";
    select("#date").value = getToday();
    select("#sampleMass").value = 5;
    select("#dieDiameter").value = 1.27;

    result.hidden = true;
    error.textContent = "";

    addElement();
  }

  select("#date").value = getToday();

  select("#addElement").addEventListener(
    "click",
    function () {
      addElement();
    }
  );

  select("#calculate").addEventListener(
    "click",
    createReport
  );

  select("#loadExample").addEventListener(
    "click",
    loadExample
  );

  select("#clear").addEventListener(
    "click",
    clearForm
  );

  loadExample();
});