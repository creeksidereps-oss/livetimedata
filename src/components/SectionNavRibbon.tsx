"use client";



import React from "react";



// Updated order: EVENTS • WEATHER • HOLIDAYS • PHOTOS • INFORMATION • WEBCAMS

const navItems = [

  { label: "EVENTS", id: "events-section" },

  { label: "WEATHER", id: "weather-section" },

  { label: "HOLIDAYS", id: "holidays-section" },

  { label: "PHOTOS", id: "photos-section" },

  { label: "INFORMATION", id: "info-section" },

  { label: "WEBCAMS", id: "webcams-section" }

];



interface SectionNavRibbonProps {

  onOpenHoliday?: () => void;

}



export default function SectionNavRibbon({ onOpenHoliday }: SectionNavRibbonProps = {}) {

  const scrollToSection = (e: React.MouseEvent, id: string) => {

    e.preventDefault();



    if (id === 'holidays-section' && onOpenHoliday) {

      onOpenHoliday();

      return;

    }



    const element = document.getElementById(id);

    if (element) {

      const headerOffset = 80; // Prevents the header from covering the section title

      const elementPosition = element.getBoundingClientRect().top;

      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;



      window.scrollTo({

        top: offsetPosition,

        behavior: "smooth"

      });

    }

  };



  return (

    <nav className="flex items-center justify-between w-full px-2 mb-1.5">

      {navItems.map((item, index) => (

        <React.Fragment key={item.label}>

          <a

            href={`#${item.id}`}

            onClick={(e) => scrollToSection(e, item.id)}

            style={{

              fontSize: "12px",

              fontWeight: 500,

              textTransform: "uppercase",

              letterSpacing: "0.12em",

              color: "#000000",

              textDecoration: "none",

              transition: "color 0.2s ease",

              cursor: "pointer"

            }}

            className="hover:text-blue-600"

          >

            {item.label}

          </a>

         

          {index < navItems.length - 1 && (

            <span style={{

              width: "4px",

              height: "4px",

              backgroundColor: "#cbd5e1",

              borderRadius: "50%",

              display: "inline-block",

              margin: "0 4px"

            }} />

          )}

        </React.Fragment>

      ))}

    </nav>

  );

}