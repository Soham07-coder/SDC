import React from "react";
import { useNavigate } from "react-router-dom";
import "../style.css";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar"; 

const forms = [
  { id: "UG_1",path: "fac-ug1", category: "UG1 In-House Student project", title: "Under Graduate Form 1" },
  { id: "UG_2", path: "fac-ug2", category: "UG2 In-House Interdisciplinary projects", title: "Under Graduate Form 2" },
  { id: "UG_3_A", path : "fac-ug3a", category: "UG3 Participation in Project Competition", title: "Under Graduate Form 3A" },
  { id: "UG_3_B", path : "fac-ug3b", category: "UG3 Participation in Reputed Conference", title: "Under Graduate Form 3B" },
  { id: "PG_1", path : "fac-pg1", category: "Professional Development Through Workshops/STTPs", title: "Post Graduate Form 1" },
  { id: "PG_2_A",path: "fac-pg2a" , category: "PG2 Participation in Project Competition", title: "Post Graduate Form 2A" },
  { id: "PG_2_B",path : "fac-pg2b" , category: "PG2 Participation in Reputed Conference", title: "Post Graduate Form 2B" },
  { id: "R1", path : "fac-r1" , category: "Publication in Reputed Journals/Papers", title: "Research Form 1" }
];

const Fachome = () => {
  const navigate = useNavigate();


  return (
    <>
    <Navbar /> 
    <div className="home-container">
     
      <div className="container">
        <Sidebar  />
        <main className="content">
         
            <div className="application-forms">
              <h1>Application Forms</h1>
              <div className="form-grid">
                {forms.map((form) => (
                  <div key={form.id} className="form-card" onClick={() => navigate(`/fachome/${form.path}`)}>
                    <h3>{form.id}</h3>
                    <p>Category: {form.category}</p>
                    <button className="fill-form-btn">View Application</button>
                  </div>
                ))}
              </div>
            </div>
          
        </main>
      </div>
    </div>
    </>
  );
};

export default Fachome;
