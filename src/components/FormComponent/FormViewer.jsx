// src/components/FormViewer.jsx
import React from "react";
import { useParams } from "react-router-dom";
import formMapper from "./FormMapper";

const FormViewer = () => {
  const { formType, formId } = useParams();

  const FormComponent = formMapper[formType];

  if (!FormComponent) {
    return <div style={{ color: "red", fontWeight: "bold" }}>❌ Unsupported form type: {formType}</div>;
  }

  return <FormComponent formId={formId} viewOnly={true} />;
};

export default FormViewer;
