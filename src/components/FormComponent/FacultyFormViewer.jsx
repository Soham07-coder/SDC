// components/faculty/FacultyFormViewer.jsx
import React from "react";
import { useParams } from "react-router-dom";

// import FacUG1Viewing from "./FacUG1Viewing";
// import FacUG2Viewing from "./FacUG2Viewing";
// // import FacUG3AViewing from "./FacUG3AViewing";
// import FacUG3BViewing from "./FacUG3BViewing";
// import FacPG1Viewing from "./FacPG1Viewing";
// import FacPG2AViewing from "./FacPG2AViewing";
// import FacPG2BViewing from "./FacPG2BViewing";
// import FacR1Viewing from "./FacR1Viewing";

const FacultyFormViewer = () => {
  const { formType, formId } = useParams();

  const renderFormComponent = () => {
    switch (formType.toLowerCase()) {
      // case "ug1":
      //   return <FacUG1Viewing formId={formId} />;
      // case "ug2":
      //   return <FacUG2Viewing formId={formId} />;
      // case "ug3a":
      //   return <FacUG3AViewing formId={formId} />;
      // case "ug3b":
      //   return <FacUG3BViewing formId={formId} />;
      // case "pg1":
      //   return <FacPG1Viewing formId={formId} />;
      // case "pg2a":
      //   return <FacPG2AViewing formId={formId} />;
      // case "pg2b":
      //   return <FacPG2BViewing formId={formId} />;
      // case "r1":
      //   return <FacR1Viewing formId={formId} />;
      default:
        return <p>Unsupported form type: {formType}</p>;
    }
  };

  return (
    <div className="faculty-form-viewer p-4">
      {renderFormComponent()}
    </div>
  );
};

export default FacultyFormViewer;
